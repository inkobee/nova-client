// ==UserScript==
// @name         Kaleido decoded tool
// @author       oasis
// @match        https://kour.io/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// ==/UserScript==

// Utility function to decode XOR-encoded strings
function decodeXORString(encodedArray, xorKey) {
    return encodedArray
        .map((byte) => String.fromCharCode(byte ^ xorKey))
        .join("");
}

// Immediately-invoked function expression (IIFE) to create a private scope
(function () {
    // --- Console Object Obfuscation/Wrapper ---
    // This function ensures a callback runs only once. Used here to initialize console wrapping.
    const runOnceWrapper = (function () {
        let isFirstCall = true;
        return function (context, callback) {
            const wrappedFunction = isFirstCall
                ? function () {
                    if (callback) {
                        const result = callback.apply(context, arguments);
                        callback = null; // Ensure it's called only once
                        return result;
                    }
                }
                : function () { }; // Subsequent calls do nothing
            isFirstCall = false;
            return wrappedFunction;
        };
    })();

    // --- Global Constants and Utilities ---
    const TOOL_VERSION = "MOMMY";

    // Determine the global window object, handling userscript environments (unsafeWindow)
    const globalWindow =
        typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    // Function to send messages to the Unity game instance
    function sendUnityMessage(gameObject, methodName, value) {
        try {
            globalWindow.unityInstance.SendMessage(gameObject, methodName, value);
        } catch (error) {
            throw error; // Re-throw if Unity instance is not available
        }
    }

    // --- Local Storage Utility Functions ---
    function getLocalStorageKeysByPrefix(prefix, recursive = false) {
        if (!prefix.endsWith("/")) {
            prefix += "/";
        }
        const matchingKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Check if key starts with prefix and is not just the prefix itself
            if (key.startsWith(prefix) && key !== prefix) {
                // If not recursive, ensure it's a direct child (no further '/' after prefix)
                if (recursive || key.indexOf("/", prefix.length) === -1) {
                    matchingKeys.push(key);
                }
            }
        }
        return matchingKeys.sort((a, b) => (a > b ? 1 : -1)); // Sort alphabetically
    }

    function setLocalStorageItem(key, value) {
        if (value !== null) {
            localStorage.setItem(key, value);
        } else {
            localStorage.removeItem(key);
        }
    }

    function getLocalStorageItem(key, defaultValue = null) {
        return localStorage.getItem(key) ?? defaultValue;
    }

    function getLocalStorageInt(key, defaultValue = null) {
        const item = localStorage.getItem(key);
        return item !== null ? parseInt(item) : defaultValue;
    }

    function getLocalStorageIntArray(key, defaultValue = null) {
        const item = localStorage.getItem(key);
        return item === null
            ? defaultValue
            : item
                .split(/[\s,]+/) // Split by spaces or commas
                .map((s) => parseInt(s.trim(), 10)) // Parse each part as integer
                .filter((n) => !isNaN(n)); // Filter out non-numbers
    }

    function getLocalStorageBoolean(key, defaultValue = null) {
        const item = localStorage.getItem(key);
        return item !== null ? item === "true" : defaultValue;
    }

    // Warn if running without unsafeWindow (e.g., not a userscript)
    if (typeof unsafeWindow === "undefined") {
        console.warn(
            TOOL_VERSION,
            ": Always make sure you are using the latest tool version from https://www.kaleidocore.com/kour before you continue."
        );
    }

    // --- Custom Data Structures ---

    // Represents a typed value, used for serialization/deserialization
    class TypedValue {
        type = 0;
        value = null;

        constructor(type, value) {
            this.type = type;
            this.value = value;
        }

        // Factory method to create a TypedValue from a raw value
        static from(rawValue) {
            switch (typeof rawValue) {
                case "number":
                    return this.fromNumber(rawValue);
                case "string":
                    return this.fromString(rawValue);
                default:
                    // If it already has a 'type' property, assume it's a TypedValue instance
                    if (rawValue !== undefined && rawValue.type !== undefined) {
                        return rawValue;
                    }
                    // Handle null specifically
                    if (rawValue === null) {
                        return this.fromString(null);
                    }
                    throw Error("Unsupported raw value type: " + typeof rawValue);
            }
        }

        // Factory method for numbers, assigning specific types based on range
        static fromNumber(num) {
            if (num === null) return new TypedValue(0x1e, null); // Null number
            if (isNaN(num)) return new TypedValue(0x1c, null); // NaN number

            if (num > 0xffff) return new TypedValue(0x9, num); // Large integer
            if (num > 0xff) return new TypedValue(0xd, num); // Medium integer (2 bytes)
            if (num >= 0x0) return new TypedValue(0xb, num); // Small positive integer (1 byte)

            if (num < -0xffff) return new TypedValue(0x9, num); // Large negative integer
            if (num < -0xff) return new TypedValue(0xe, num); // Medium negative integer (2 bytes)
            if (num < 0x0) return new TypedValue(0xc, num); // Small negative integer (1 byte)

            throw Error("Unsupported number: " + num);
        }

        // Factory method for strings
        static fromString(str) {
            return str === null
                ? new TypedValue(0x8, null)
                : new TypedValue(0x7, str);
        }

        toString() {
            return this.value.toString();
        }

        valueOf() {
            return this.value;
        }

        equals(other) {
            if (other instanceof TypedValue) {
                return other.type === this.type && other.value === this.value;
            }
            return this.value === other;
        }

        // Allows implicit conversion to primitive types
        [Symbol.toPrimitive](hint) {
            return hint === "string" ? this.value.toString() : this.value;
        }

        toJSON() {
            return {
                type: this.type,
                value: this.value,
            };
        }
    }

    // Extends Map to add a name and signature, used for message parsing
    class KeyMap extends Map {
        name = "Unknown";
        signature = null;

        constructor(name, signature) {
            super();
            this.name = name;
            this.signature = signature;
        }

        static EMPTY = new KeyMap(null, null); // A static empty KeyMap instance

        toString() {
            return `KeyMap: ${this.name} (${this.size} entries)`;
        }

        toJSON() {
            return Object.fromEntries(this.entries());
        }
    }

    // Extends Map to handle TypedValue keys correctly (using .equals() for comparison)
    class TypedKeyMap extends Map {
        type = 0x15; // Specific type identifier for this map

        set(key, value) {
            // Check if an equivalent TypedValue key already exists
            for (const existingKey of this.keys()) {
                if (existingKey instanceof TypedValue && existingKey.equals(key)) {
                    super.set(existingKey, value); // Update existing entry
                    return this;
                }
            }
            super.set(key, value); // Add new entry
            return this;
        }

        get(key) {
            for (const [existingKey, value] of this.entries()) {
                if (existingKey instanceof TypedValue && existingKey.equals(key)) {
                    return value;
                }
            }
            return super.get(key); // Fallback to default Map.get
        }

        has(key) {
            for (const existingKey of this.keys()) {
                if (existingKey instanceof TypedValue && existingKey.equals(key)) {
                    return true;
                }
            }
            return super.has(key); // Fallback to default Map.has
        }

        toJSON() {
            return Object.fromEntries(this.entries());
        }
    }

    // Base class for reading and writing binary data
    class BinaryStream {
        buffer = null; // Uint8Array to hold the data
        position = 0; // Current read/write position

        constructor(initialBuffer = null) {
            this.buffer = initialBuffer || new Uint8Array(0x40); // Default size 64 bytes
            this.position = 0;
        }

        get data() {
            return this.buffer.subarray(0, this.position);
        }

        get remainingCapacity() {
            return this.buffer.length - this.position;
        }

        get isEndOfStream() {
            return this.position >= this.buffer.length;
        }

        get totalLength() {
            return this.buffer.length;
        }

        hasEnoughCapacity(length) {
            // 'Length must be non-negative' (original comment)
            return this.position + length <= this.buffer.length;
        }

        // Placeholder for validation/error handling (original 'U' method)
        _validateRead(length) {
            // if (!this.hasEnoughCapacity(length)) {
            //   throw new Error(`Stream EOF: tried to read ${length} bytes, but only ${this.remainingCapacity} available.`);
            // }
        }

        get hexText() {
            return Array.from(this.data)
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join(" ");
        }

        toString() {
            return this.hexText;
        }

        seek(offset) {
            // Original comments: 'Seek position out of bounds: ' + this.position + ' (length: ' + this.buffer.length + ')'
            this.position += offset;
        }

        peekByte() {
            this._validateRead(1);
            return this.buffer[this.position];
        }

        readByte() {
            this._validateRead(1);
            return this.buffer[this.position++];
        }

        writeByte(value) {
            this._ensureCapacity(1);
            this.buffer[this.position++] = 0xff & value;
        }

        readBytes(length) {
            this._validateRead(length);
            const bytes = this.buffer.subarray(this.position, this.position + length);
            this.position += length;
            return bytes;
        }

        writeBytes(byteArray) {
            this._ensureCapacity(byteArray.length);
            this.buffer.set(byteArray, this.position);
            this.position += byteArray.length;
        }

        readUInt16() {
            this._validateRead(2);
            const value =
                (this.buffer[this.position + 1] << 8) | this.buffer[this.position];
            this.position += 2;
            return value;
        }

        writeUInt16(value) {
            this._ensureCapacity(2);
            this.buffer[this.position++] = 0xff & value;
            this.buffer[this.position++] = (value >> 8) & 0xff;
        }

        readUInt32() {
            this._validateRead(4);
            const value =
                (this.buffer[this.position + 3] << 24) |
                (this.buffer[this.position + 2] << 16) |
                (this.buffer[this.position + 1] << 8) |
                this.buffer[this.position];
            this.position += 4;
            return value;
        }

        writeUInt32(value) {
            this._ensureCapacity(4);
            this.buffer[this.position++] = 0xff & value;
            this.buffer[this.position++] = (value >> 8) & 0xff;
            this.buffer[this.position++] = (value >> 16) & 0xff;
            this.buffer[this.position++] = (value >> 24) & 0xff;
        }

        readUInt64() {
            this._validateRead(8);
            // Note: JavaScript numbers are 64-bit floats, so large integers might lose precision.
            const low =
                (this.buffer[this.position + 3] << 24) |
                (this.buffer[this.position + 2] << 16) |
                (this.buffer[this.position + 1] << 8) |
                this.buffer[this.position];
            const high =
                (this.buffer[this.position + 7] << 24) |
                (this.buffer[this.position + 6] << 16) |
                (this.buffer[this.position + 5] << 8) |
                this.buffer[this.position + 4];
            this.position += 8;
            return high * 0x100000000 + low; // Combine two 32-bit parts
        }

        writeUInt64(value) {
            this._ensureCapacity(8);
            const low = 0xffffffff & value;
            const high = Math.floor(value / 0x100000000);
            this.buffer[this.position++] = 0xff & low;
            this.buffer[this.position++] = (low >> 8) & 0xff;
            this.buffer[this.position++] = (low >> 16) & 0xff;
            this.buffer[this.position++] = (low >> 24) & 0xff;
            this.buffer[this.position++] = 0xff & high;
            this.buffer[this.position++] = (high >> 8) & 0xff;
            this.buffer[this.position++] = (high >> 16) & 0xff;
            this.buffer[this.position++] = (high >> 24) & 0xff;
        }

        readFloat32() {
            this._validateRead(4);
            const value = new DataView(
                this.buffer.buffer,
                this.buffer.byteOffset
            ).getFloat32(this.position, false);
            this.position += 4;
            return value;
        }

        writeFloat32(value) {
            this._ensureCapacity(4);
            new DataView(this.buffer.buffer, this.buffer.byteOffset).setFloat32(
                this.position,
                value,
                false
            );
            this.position += 4;
        }

        readFloat64() {
            this._validateRead(8);
            const value = new DataView(
                this.buffer.buffer,
                this.buffer.byteOffset
            ).getFloat64(this.position, true);
            this.position += 8;
            return value;
        }

        writeFloat64(value) {
            this._ensureCapacity(8);
            new DataView(this.buffer.buffer, this.buffer.byteOffset).setFloat64(
                this.position,
                value,
                true
            );
            this.position += 8;
        }

        readString(length) {
            const bytes = this.readBytes(length);
            return String.fromCharCode(...bytes);
        }

        writeString(str) {
            const bytes = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                bytes[i] = 0xff & str.charCodeAt(i);
            }
            this.writeBytes(bytes);
        }

        // Ensures the buffer has enough space, resizing if needed
        _ensureCapacity(requiredLength) {
            if (this.position + requiredLength > this.buffer.length) {
                const newBuffer = new Uint8Array(
                    Math.max(2 * this.buffer.length, this.position + requiredLength)
                );
                newBuffer.set(this.buffer);
                this.buffer = newBuffer;
            }
        }

        // Trims the buffer to the actual data length
        trimBuffer() {
            if (this.buffer.length > this.position) {
                this.buffer = this.buffer.slice(0, this.position);
            }
        }

        // Placeholder for validation (original 'V' method)
        _validateMarker(expectedMarker, errorMessage = "") {
            // if (this.readByte() !== expectedMarker) {
            //   throw new Error(errorMessage || `Unexpected marker: expected ${expectedMarker}`);
            // }
            this.position++; // Advance position even if not validated
        }
    }

    // Extends BinaryStream to handle custom TypedValue objects and arrays
    class CustomDataStream extends BinaryStream {
        constructor(initialBuffer = null) {
            super(initialBuffer);
        }

        // Read a string (can be null)
        readTypedString() {
            const marker = this.readByte();
            if (marker === 0x7) {
                // String marker
                return this.readString(this.readVarInt());
            }
            if (marker === 0x8) {
                // Null string marker
                return null;
            }
            throw Error(
                `Invalid string marker ${marker} at pos ${this.position - 1}`
            );
        }

        // Write a string (can be null)
        writeTypedString(str) {
            if (str !== null) {
                this.writeByte(0x7); // String marker
                this.writeVarInt(str.length);
                this.writeString(str);
            } else {
                this.writeByte(0x8); // Null string marker
            }
        }

        // Read a number (as TypedValue)
        readTypedNumber() {
            const marker = this.readByte();
            switch (marker) {
                case 0x3: // 1-byte unsigned int
                case 0xb: // 1-byte unsigned int
                    return new TypedValue(marker, this.readByte());
                case 0xc: // 1-byte negative int
                    return new TypedValue(marker, 0x0 - this.readByte());
                case 0xd: // 2-byte unsigned int
                    return new TypedValue(marker, this.readUInt16());
                case 0xe: // 2-byte negative int
                    return new TypedValue(marker, 0x0 - this.readUInt16());
                case 0x5: // 4-byte unsigned int
                    return new TypedValue(marker, this.readUInt32());
                case 0x6: // 8-byte float (double)
                    return new TypedValue(marker, this.readFloat64());
                case 0x9: // Varint (signed or unsigned, depends on context)
                    return this.readSignedVarInt();
                case 0x1b: // Special null/empty values
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    return new TypedValue(marker, null);
                default:
                    throw Error(
                        `Invalid number marker ${marker} at ${this.position - 1}`
                    );
            }
        }

        // Write a number (from TypedValue or raw number)
        writeTypedNumber(num) {
            let typedNum;
            if (num instanceof TypedValue) {
                typedNum = num;
            } else {
                typedNum = TypedValue.fromNumber(num);
            }

            this.writeByte(typedNum.type);
            switch (typedNum.type) {
                case 0x3:
                case 0xb:
                    this.writeByte(typedNum.value);
                    break;
                case 0xc:
                    this.writeByte(0x0 - typedNum.value);
                    break;
                case 0xd:
                    this.writeUInt16(typedNum.value);
                    break;
                case 0xe:
                    this.writeUInt16(0x0 - typedNum.value);
                    break;
                case 0x5:
                    this.writeUInt32(typedNum.value);
                    break;
                case 0x6:
                    this.writeFloat64(typedNum.value);
                    break;
                case 0x9:
                    this.writeSignedVarInt(typedNum.value);
                    break;
                case 0x1b:
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    // No value to write for these types
                    break;
                default:
                    throw Error(`Invalid number type ${typedNum.type}`);
            }
        }

        // Read unsigned variable-length integer (Varint)
        readVarInt() {
            let value = 0;
            let shift = 0;
            while (true) {
                const byte = this.readByte();
                value |= (byte & 0x7f) << shift;
                if (!(byte & 0x80)) {
                    // If MSB is not set, it's the last byte
                    break;
                }
                shift += 7;
            }
            return new TypedValue(0x9, value >>> 0); // Return as unsigned 32-bit
        }

        // Write unsigned variable-length integer (Varint)
        writeVarInt(value) {
            while (true) {
                let byte = value & 0x7f;
                value >>>= 7;
                if (value === 0) {
                    this.writeByte(byte);
                    break;
                }
                this.writeByte(byte | 0x80); // Set MSB to indicate more bytes follow
            }
        }

        // Read signed variable-length integer (ZigZag encoding)
        readSignedVarInt() {
            let value = 0;
            let shift = 0;
            let byte;
            while (true) {
                byte = this.readByte();
                value |= (byte & 0x7f) << shift;
                if (!(byte & 0x80)) {
                    break;
                }
                shift += 7;
            }
            // Apply ZigZag decoding
            if (shift < 32 && byte & 0x40) {
                // If sign bit is set
                value |= -1 << shift;
            }
            return new TypedValue(0x8, value); // Return as signed integer
        }

        // Write signed variable-length integer (ZigZag encoding)
        writeSignedVarInt(value) {
            value |= 0; // Ensure it's a 32-bit integer
            while (true) {
                let byte = value & 0x7f;
                value >>= 7;
                if (value === 0 || value === -1) {
                    // If value is 0 or -1 (all ones in 2's complement)
                    this.writeByte(byte);
                    break;
                }
                this.writeByte(byte | 0x80);
            }
        }

        // Read a "tag" marker (TypedValue)
        readTag() {
            this._validateMarker(0x22, "Bad tag marker");
            return this.readTypedNumber();
        }

        // Write a "tag" marker (TypedValue)
        writeTag(value) {
            this.writeByte(0x22);
            this.writeTypedNumber(value);
        }

        // Read an "id" marker (TypedValue)
        readId() {
            this._validateMarker(0xfe, "Bad id marker");
            return this.readTypedNumber();
        }

        // Write an "id" marker (TypedValue)
        writeId(value) {
            this.writeByte(0xfe);
            this.writeTypedNumber(value);
        }

        // Write a timestamp (using a specific TypedValue for timestamp)
        writeTimestamp() {
            this.writeTypedNumber(MESSAGE_FIELD_IDS.timestamp);
            this.writeTypedNumber(0xcafe); // Magic number for timestamp
        }

        // Read a TypedKeyMap (dictionary)
        readTypedKeyMap() {
            this._validateMarker(0x15, "Bad dictionary marker");
            const size = this.readByte();
            const map = new TypedKeyMap();
            for (let i = 0; i < size; i++) {
                const key = this.readAnyTypedValue();
                const value = this.readAnyTypedValue();
                map.set(key, value);
            }
            return map;
        }

        // Write a TypedKeyMap (dictionary)
        writeTypedKeyMap(map) {
            this.writeByte(0x15);
            this.writeByte(map.size);
            map.forEach((value, key) => {
                this.writeAnyTypedValue(key);
                this.writeAnyTypedValue(value);
            });
        }

        // Read a KeyMap (message structure)
        readKeyMap(name, signature) {
            const keyMap = new KeyMap(name, signature);
            this.seek(signature.length); // Advance past the signature bytes
            while (!this.isEndOfStream) {
                const key = this.readByte(); // Key is a single byte
                if (this.isEndOfStream) {
                    continue; // Avoid reading past end if key was last byte
                }
                const value = this.readAnyTypedValue();
                keyMap.set(key, value);
            }
            return keyMap;
        }

        // Write a KeyMap (message structure)
        writeKeyMap(keyMap) {
            this.writeBytes(keyMap.signature);
            keyMap.forEach((value, key) => {
                this.writeByte(key);
                this.writeAnyTypedValue(value);
            });
        }

        // Read a string array
        readStringArray() {
            this._validateMarker(0x47, "Bad string array marker");
            const size = this.readByte();
            const array = [];
            array.type = 0x47; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const str = this.readString(this.readByte()); // Read length then string
                array.push(str);
            }
            return array;
        }

        // Write a string array
        writeStringArray(array) {
            this.writeByte(0x47);
            this.writeByte(array.length);
            array.forEach((str) => {
                this.writeByte(str.length);
                this.writeString(str);
            });
        }

        // Read a Varint array
        readVarIntArray() {
            this._validateMarker(0x49, "Bad Varint array marker");
            const size = this.readByte();
            const array = new Array(size);
            array.type = 0x49; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const value = this.readSignedVarInt();
                array[i] = value;
            }
            return array;
        }

        // Write a Varint array
        writeVarIntArray(array) {
            this.writeByte(0x49);
            this.writeByte(array.length);
            for (let i = 0; i < array.length; i++) {
                this.writeSignedVarInt(array[i]);
            }
        }

        // Read an "any" array (array of mixed TypedValues)
        readAnyArray() {
            this._validateMarker(0x17, "Bad any array marker");
            const size = this.readByte();
            const array = [];
            array.type = 0x17; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const value = this.readAnyTypedValue();
                array.push(value);
            }
            return array;
        }

        // Write an "any" array
        writeAnyArray(array) {
            this.writeByte(0x17);
            this.writeByte(array.length);
            for (let i = 0; i < array.length; i++) {
                this.writeAnyTypedValue(array[i]);
            }
        }

        // Read an "array-array" (array of arrays)
        readArrayOfArrays() {
            this._validateMarker(0x40, "Bad array-array marker");
            const size = this.readByte();
            const array = [];
            array.type = 0x40; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const value = this.readAnyTypedValue(); // Each element is an "any" type
                array.push(value);
            }
            return array;
        }

        // Write an "array-array"
        writeArrayOfArrays(array) {
            this.writeByte(0x40);
            this.writeByte(array.length);
            for (let i = 0; i < array.length; i++) {
                this.writeAnyTypedValue(array[i]);
            }
        }

        // Read a raw byte array (length prefixed)
        readLengthPrefixedByteArray() {
            const length = this.readByte();
            return this.readBytes(length);
        }

        // Write a raw byte array (length prefixed)
        writeLengthPrefixedByteArray(byteArray) {
            this.writeByte(byteArray.length);
            this.writeBytes(byteArray);
        }

        // Read a specific 5-byte array (type 0xDA)
        readSpecial5ByteArray() {
            this._validateMarker(0xda);
            const bytes = this.readBytes(5);
            bytes.type = 0xda; // Custom property to indicate type
            return bytes;
        }

        // Write a specific 5-byte array (type 0xDA)
        writeSpecial5ByteArray(byteArray) {
            // Original comments: 'Strange 40 array must be exactly 5 bytes long, got ' + byteArray.length
            this.writeByte(0xda);
            this.writeBytes(byteArray);
        }

        // Read a 3-float array (Point3, type 0xD6)
        readPoint3Array() {
            this._validateMarker(0xd6);
            this._validateMarker(0xc); // Marker for 12 bytes (3 floats * 4 bytes/float)
            const array = [null, null, null]; // Initialize with nulls
            for (let i = 0; i < 3; i++) {
                const floatValue = this.readFloat32();
                array[i] = floatValue;
            }
            array.type = 0xd6; // Custom property to indicate type
            return array;
        }

        // Write a 3-float array (Point3)
        writePoint3Array(array) {
            this.writeByte(0xd6);
            this.writeByte(0xc); // Marker for 12 bytes
            // Original comments: 'Point3 array must be exactly 3 floats long, got ' + array.length
            for (let i = 0; i < 3; i++) {
                // Original comments: 'Point3 array must contain only numbers, got ' + array[i] + ' at index ' + i
                this.writeFloat32(array[i]);
            }
        }

        // Read a 4-float array (Point4, type 0xD1)
        readPoint4Array() {
            this._validateMarker(0xd1);
            this._validateMarker(0x10); // Marker for 16 bytes (4 floats * 4 bytes/float)
            const array = [null, null, null, null]; // Initialize with nulls
            for (let i = 0; i < 4; i++) {
                const floatValue = this.readFloat32();
                array[i] = floatValue;
            }
            array.type = 0xd1; // Custom property to indicate type
            return array;
        }

        // Write a 4-float array (Point4)
        writePoint4Array(array) {
            this.writeByte(0xd1);
            this.writeByte(0x10); // Marker for 16 bytes
            // Original comments: 'Point4 array must be exactly 4 floats long, got ' + array.length
            for (let i = 0; i < 4; i++) {
                // Original comments: 'Point4 array must contain only numbers, got ' + array[i] + ' at index ' + i
                this.writeFloat32(array[i]);
            }
        }

        // Read a 3D point array (array of [x,y,z] float arrays, type 0x53)
        read3DPointArray() {
            this._validateMarker(0x53, "Bad 3d point array marker");
            const size = this.readByte();
            this._validateMarker(0x56); // Another marker
            const array = [];
            array.type = 0x53; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                this._validateMarker(0xc); // Marker for 12 bytes (3 floats)
                const x = this.readFloat32();
                const y = this.readFloat32();
                const z = this.readFloat32();
                array.push([x, y, z]);
            }
            return array;
        }

        // Write a 3D point array
        write3DPointArray(array) {
            this.writeByte(0x53);
            this.writeByte(array.length);
            this.writeByte(0x56);
            for (const point of array) {
                // Original comments: 'Point3 array must contain arrays of 3 floats, got ' + point.length
                // Original comments: 'Point3 array must contain only numbers, got ' + point[0] + ', ' + point[1] + ', ' + point[2]
                this.writeByte(0xc); // Marker for 12 bytes
                this.writeFloat32(point[0]);
                this.writeFloat32(point[1]);
                this.writeFloat32(point[2]);
            }
        }

        // Read any TypedValue based on its marker byte
        readAnyTypedValue() {
            const marker = this.peekByte(); // Peek to determine type
            switch (marker) {
                case 0x3:
                case 0x5:
                case 0x6:
                case 0x9:
                case 0xb:
                case 0xc:
                case 0xd:
                case 0xe:
                case 0x1b:
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    return this.readTypedNumber();
                case 0x7:
                case 0x8:
                    return this.readTypedString();
                case 0x15:
                    return this.readTypedKeyMap();
                case 0x17:
                    return this.readAnyArray();
                case 0x40:
                    return this.readArrayOfArrays();
                case 0x47:
                    return this.readStringArray();
                case 0x49:
                    return this.readVarIntArray();
                case 0x53:
                    return this.read3DPointArray();
                case 0xd1:
                    return this.readPoint4Array();
                case 0xd6:
                    return this.readPoint3Array();
                case 0xda:
                    return this.readSpecial5ByteArray();
                default:
                    throw Error(
                        `Unknown any type ${marker} at position ${this.position}`
                    );
            }
        }

        // Write any TypedValue based on its 'type' property
        writeAnyTypedValue(value) {
            // Ensure value is a TypedValue instance if it's not already
            if (!value || value.type === undefined) {
                value = TypedValue.from(value);
            }

            switch (value.type) {
                case 0x3:
                case 0x5:
                case 0x6:
                case 0x9:
                case 0xb:
                case 0xc:
                case 0xd:
                case 0xe:
                case 0x1b:
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    this.writeTypedNumber(value);
                    break;
                case 0x7:
                case 0x8:
                    this.writeTypedString(value);
                    break;
                case 0x15:
                    this.writeTypedKeyMap(value);
                    break;
                case 0x17:
                    this.writeAnyArray(value);
                    break;
                case 0x40:
                    this.writeArrayOfArrays(value);
                    break;
                case 0x47:
                    this.writeStringArray(value);
                    break;
                case 0x49:
                    this.writeVarIntArray(value);
                    break;
                case 0x53:
                    this.write3DPointArray(value);
                    break;
                case 0xd1:
                    this.writePoint4Array(value);
                    break;
                case 0xd6:
                    this.writePoint3Array(value);
                    break;
                case 0xda:
                    this.writeSpecial5ByteArray(value);
                    break;
                default:
                    throw Error(
                        `Unhandled any type ${value.type} when writing at position ${this.position}`
                    );
            }
        }
    }

    // --- Game Constants and Message Signatures ---

    const GAME_CONSTANTS = {
        MAGIC_NUMBER_1: 0xcafe,
        MAGIC_NUMBER_2: 0xbabe,
        WEAPON_EXCLUSION_IDS: [0xcafe, 0xbabe, 0xdead], // IDs that bypass certain checks
        BOOTLEG_TOOL_IDS: [0x1ddaaa, 0x199daa, 0x14d], // IDs related to bootleg tool detection
    };

    // Server-to-Client Message Signatures (Uint8Array prefixes)
    const SERVER_MESSAGE_SIGNATURES = {
        PLAYER_UPDATE: new Uint8Array([0xf3, 0x4, 0xc9, 0x2]),
        PLAYER_MOVE: new Uint8Array([0xf3, 0x4, 0xce, 0x2]),
        PLAYER_ACTION: new Uint8Array([0xf3, 0x4, 0xc8, 0x2]),
        PLAYER_INFO: new Uint8Array([0xf3, 0x4, 0xca, 0x2]),
        PLAYER_LEAVE: new Uint8Array([0xf3, 0x4, 0xcc, 0x2]),
        ROOM_INFO: new Uint8Array([0xf3, 0x4, 0xfd, 0x3]),
        ROOM_STATE_UPDATE_1: new Uint8Array([0xf3, 0x3, 0xfc, 0x0, 0x0, 0x8, 0x0]),
        ROOM_STATE_UPDATE_2: new Uint8Array([0xf3, 0x3, 0xfd, 0x0, 0x0, 0x8, 0x0]),
        TIME_SYNC: new Uint8Array([0xf3, 0x7, 0x1, 0x0, 0x0, 0x8, 0x2]),
        PLAYER_SPAWN: new Uint8Array([0xf3, 0x4, 0xe2, 0x3]),
        COMMAND_MESSAGE: new Uint8Array([0xf3, 0x4, 0x0, 0x2]), // Custom command messages
        UNKNOWN_MESSAGE_1: new Uint8Array([0xf3, 0x4, 0x3, 0x2]),
        PLAYER_JOIN: new Uint8Array([0xf3, 0x4, 0xff, 0x3]),
        PLAYER_REMOVE_1: new Uint8Array([0xf3, 0x4, 0xfe, 0x3]),
        PLAYER_REMOVE_2: new Uint8Array([0xf3, 0x4, 0xfe, 0x4]),
        UNKNOWN_MESSAGE_2: new Uint8Array([0xf3, 0x4, 0x2, 0x2]),
        UNKNOWN_MESSAGE_3: new Uint8Array([0xf3, 0x4, 0x6, 0x2]),
        UNKNOWN_MESSAGE_4: new Uint8Array([0xf3, 0x4, 0x7, 0x2]),
        UNKNOWN_MESSAGE_5: new Uint8Array([0xf3, 0x4, 0xd4, 0x2]),
        UNKNOWN_MESSAGE_6: new Uint8Array([0xf3, 0x4, 0xd1, 0x2]),
        UNKNOWN_MESSAGE_7: new Uint8Array([0xf3, 0x4, 0xd2, 0x2]),
        RESET_STATE_1: new Uint8Array([0xf3, 0x1, 0x0]),
        RESET_STATE_2: new Uint8Array([0xf3, 0x3, 0xe6, 0x0, 0x0, 0x8, 0x0]),
        RESET_STATE_3: new Uint8Array([0xf3, 0x3, 0xfe, 0x0, 0x0, 0x8, 0x0]),
        SERVER_STATE: new Uint8Array([0xf3, 0x3, 0xe2, 0x0, 0x0, 0x8, 0x5]),
        PLAYER_JOIN_ROOM: new Uint8Array([0xf3, 0x3, 0xe2, 0x0, 0x0, 0x8, 0x2]),
        PLAYER_LEAVE_ROOM: new Uint8Array([0xf3, 0x3, 0xe3, 0x0, 0x0, 0x8, 0x3]),
        UNKNOWN_MESSAGE_8: new Uint8Array([0xf3, 0x3, 0xe6, 0x0, 0x0, 0x8, 0x2]),
        UNKNOWN_MESSAGE_9: new Uint8Array([0xf3, 0x4, 0xdf, 0x1]),
        UNKNOWN_MESSAGE_10: new Uint8Array([0xf3, 0x3, 0xd9, 0x0, 0x0, 0x8, 0x1]),
        PLAYER_JOIN_ROOM_2: new Uint8Array([0xf3, 0x3, 0xe3, 0x0, 0x0, 0x8, 0x4]),
        UNKNOWN_MESSAGE_11: new Uint8Array([0xf3, 0x3, 0xe2, 0xf6]),
        UNKNOWN_MESSAGE_12: new Uint8Array([0xf3, 0x3, 0xe2, 0xfc]),
        UNKNOWN_MESSAGE_13: new Uint8Array([0xf3, 0x3, 0xe2, 0xfd]),
        UNKNOWN_MESSAGE_14: new Uint8Array([0xf3, 0x3, 0xe3, 0xfe]),
        UNKNOWN_MESSAGE_15: new Uint8Array([0xf3, 0x3, 0xfd, 0xfe]),
        UNKNOWN_MESSAGE_16: new Uint8Array([0xf3, 0x3, 0xe6, 0xf1]),
    };

    // Client-to-Server Message Signatures (Uint8Array prefixes)
    const CLIENT_MESSAGE_SIGNATURES = {
        PLAYER_ACTION_1: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xc9]),
        PLAYER_ACTION_2: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xce]),
        PLAYER_ACTION_3: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xc8]),
        PLAYER_ACTION_4: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xcc]),
        GENERIC_ACTION: new Uint8Array([0xf3, 0x2, 0xfd, 0x2]),
        PLAYER_SPAWN: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf7, 0x3, 0x4, 0xf4, 0x3, 0xc8,
        ]),
        PLAYER_KILL: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf7, 0x3, 0x4, 0xf4, 0x3, 0xca,
        ]),
        PLAYER_DAMAGE: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf7, 0x3, 0x6, 0xf4, 0x3, 0xc8,
        ]),
        CHAT_MESSAGE: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf6, 0x3, 0x1, 0xf4, 0x22,
        ]),
        UNKNOWN_ACTION_1: new Uint8Array([0xf3, 0x2, 0xfd, 0x3]),
        UNKNOWN_ACTION_2: new Uint8Array([0xf3, 0x2, 0xfd, 0x4]),
        SET_LOBBY_SKIN: new Uint8Array([0xf3, 0x2, 0xfc, 0x3]),
        UNKNOWN_ACTION_3: new Uint8Array([0xf3, 0x6, 0x1, 0x1]),
        JOIN_ROOM: new Uint8Array([0xf3, 0x2, 0xfe, 0x0]),
        UNKNOWN_ACTION_4: new Uint8Array([0xf3, 0x2, 0xe6, 0x1]),
        UNKNOWN_ACTION_5: new Uint8Array([0xf3, 0x2, 0xe3, 0x3]),
        UNKNOWN_ACTION_6: new Uint8Array([0xf3, 0x2, 0xe3, 0x9]),
        UNKNOWN_ACTION_7: new Uint8Array([0xf3, 0x2, 0xe3, 0x8]),
        SET_NICKNAME: new Uint8Array([0xf3, 0x2, 0xe2, 0x1]),
        UNKNOWN_ACTION_8: new Uint8Array([0xf3, 0x2, 0xd9, 0x3]),
        ROOM_STATE_REQUEST: new Uint8Array([0xf3, 0x2, 0xfc, 0x2]),
        UNKNOWN_ACTION_9: new Uint8Array([0xf3, 0x2, 0xe3, 0x1]),
        UNKNOWN_ACTION_10: new Uint8Array([0xf3, 0x2, 0xe2, 0x7]),
        UNKNOWN_ACTION_11: new Uint8Array([0xf3, 0x2, 0xfc, 0x4]),
    };

    // Function to parse an incoming binary message based on its signature
    function parseBinaryMessage(signatureMap, rawData) {
        const isSignatureMatch = (expectedSignature, actualData) => {
            if (expectedSignature.length > actualData.length) {
                return false;
            }
            for (let i = 0; i < expectedSignature.length; i++) {
                if (expectedSignature[i] !== actualData[i]) {
                    return false;
                }
            }
            return true;
        };

        for (const key of Object.keys(signatureMap)) {
            const signature = signatureMap[key];
            if (isSignatureMatch(signature, rawData)) {
                return new CustomDataStream(rawData).readKeyMap(key, signature);
            }
        }
        throw Error("Unknown signature");
    }

    // Identifiers for common message fields
    const MESSAGE_FIELD_IDS = {
        messageType: 0xf3,
        id: 0xfe,
        name: 0xff,
        content: 0xf5,
        playerData: 0xf9, // 'Js'
        roomData: 0xfb, // 'zs'
        playerState: 0xf8, // 'Zs'
        playerType: new TypedValue(0x22, null), // 'js'
        tag: new TypedValue(0x3, 0x7), // 'tag'
        action: new TypedValue(0x3, 0x5), // 'action'
        timestamp: new TypedValue(0x3, 0x2), // 'timestamp'
    };

    // --- Dance Definitions ---
    const DANCES = {
        NONE: "None",
        STYLE_DANCE: "Style Dance",
        MACARENA: "Macarena",
        CHICKEN_DANCE: "Chicken Dance",
        YMCA: "YMCA",
        NUMA_NUMA: "NumaNuma",
        SKIBIDI: "Skibidi",
        BACKOURFLIP: "Backourflip",
        BLUE: "Blue",

        getDuration(danceName) {
            switch (danceName) {
                case this.STYLE_DANCE:
                    return 0x3a98; // 15000 ms
                case this.MACARENA:
                    return 0x1f40; // 8000 ms
                case this.CHICKEN_DANCE:
                    return 0x2710; // 10000 ms
                case this.YMCA:
                    return 0x2328; // 9000 ms
                case this.NUMA_NUMA:
                    return 0x2ee0; // 12000 ms
                case this.SKIBIDI:
                    return 0x30d4; // 12500 ms
                case this.BACKOURFLIP:
                    return 0x3e8; // 1000 ms
                case this.BLUE:
                    return 0x2710; // 10000 ms
                default:
                    throw Error("Unknown dance name: " + danceName);
            }
        },

        getDanceListForUI() {
            return [
                {
                    label: "Style Dance",
                    value: this.STYLE_DANCE,
                },
                {
                    label: "Macarena",
                    value: this.MACARENA,
                },
                {
                    label: "Chicken Dance",
                    value: this.CHICKEN_DANCE,
                },
                {
                    label: "YMCA",
                    value: this.YMCA,
                },
                {
                    label: "Numa Numa",
                    value: this.NUMA_NUMA,
                },
                {
                    label: "Skibidi",
                    value: this.SKIBIDI,
                },
                {
                    label: "Backourflip",
                    value: this.BACKOURFLIP,
                },
                {
                    label: "Blue",
                    value: this.BLUE,
                },
            ];
        },
    };

    // --- Class Definitions ---
    const CLASSES = {
        NONE: -1,
        SOLDIER: 0x0,
        HITMAN: 0x1,
        GUNNER: 0x2,
        HEAVY: 0x3,
        ROCKETEER: 0x4,
        AGENT: 0x5,
        BRAWLER: 0x6,
        INVESTOR: 0x7,
        ASSASSIN: 0x8,
        JUGGERNAUT: 0x9,
        RECON: 0xa,
        PYRO: 0xb,
        RAYBLADER: 0xc,

        getId(name) {
            switch (name.toLowerCase()) {
                case "soldier":
                    return this.SOLDIER;
                case "hitman":
                    return this.HITMAN;
                case "gunner":
                    return this.GUNNER;
                case "heavy":
                    return this.HEAVY;
                case "rocketeer":
                    return this.ROCKETEER;
                case "agent":
                    return this.AGENT;
                case "brawler":
                    return this.BRAWLER;
                case "investor":
                    return this.INVESTOR;
                case "assassin":
                    return this.ASSASSIN;
                case "juggernaut":
                    return this.JUGGERNAUT;
                case "recon":
                    return this.RECON;
                case "pyro":
                    return this.PYRO;
                case "rayblader":
                    return this.RAYBLADER;
                default:
                    return this.NONE;
            }
        },

        getName(id) {
            switch (id) {
                case this.SOLDIER:
                    return "Soldier";
                case this.HITMAN:
                    return "Hitman";
                case this.GUNNER:
                    return "Gunner";
                case this.HEAVY:
                    return "Heavy";
                case this.ROCKETEER:
                    return "Rocketeer";
                case this.AGENT:
                    return "Agent";
                case this.BRAWLER:
                    return "Brawler";
                case this.INVESTOR:
                    return "Investor";
                case this.ASSASSIN:
                    return "Assassin";
                case this.JUGGERNAUT:
                    return "Juggernaut";
                case this.RECON:
                    return "Recon";
                case this.PYRO:
                    return "Pyro";
                case this.RAYBLADER:
                    return "Rayblader";
                default:
                    return "None";
            }
        },
    };

    // --- Map Definitions ---
    const MAPS = {
        NONE: -1,
        HAVANA: 0x1,
        SNOWSTORM: 0x2,
        NEWTOWN: 0x3,
        KOURHOUSE: 0x4,
        GHOST_TOWN: 0x5,
        LEGION_HQ: 0x6,
        KOUR_SURF: 0x7,
        KOUR2: 0x8,
        OLDSTORM: 0x9,
        BATTLE_ROYALE: 0xa,
        KOUR3: 0xb,
        SKYLINE: 0xc,
        MOON_SNIPE: 0xd,
        KOUR_CRAFT: 0xe,
        PARKOUR: 0xf,
        UNDERKOUR: 0x10,

        getName(id) {
            switch (id) {
                case this.HAVANA:
                    return "Havana";
                case this.SNOWSTORM:
                    return "Snowstorm";
                case this.NEWTOWN:
                    return "Newtown";
                case this.KOURHOUSE:
                    return "Kourhouse";
                case this.GHOST_TOWN:
                    return "Ghost Town";
                case this.LEGION_HQ:
                    return "Legion HQ";
                case this.KOUR_SURF:
                    return "Kour Surf";
                case this.KOUR2:
                    return "Kour2";
                case this.OLDSTORM:
                    return "OldStorm";
                case this.BATTLE_ROYALE:
                    return "Battle Royale";
                case this.KOUR3:
                    return "Kour3";
                case this.SKYLINE:
                    return "Skyline";
                case this.MOON_SNIPE:
                    return "Moon Snipe";
                case this.KOUR_CRAFT:
                    return "Kour Craft";
                case this.PARKOUR:
                    return "Parkour";
                case this.UNDERKOUR:
                    return "Underkour";
                default:
                    return "Unknown";
            }
        },

        // Returns a value related to chicken spawning for each map
        getChickenSpawnValue(mapId) {
            switch (mapId) {
                case this.HAVANA:
                    return 0x8;
                case this.SNOWSTORM:
                    return 0xb;
                case this.NEWTOWN:
                case this.KOURHOUSE:
                case this.GHOST_TOWN:
                    return 0x6;
                case this.LEGION_HQ:
                    return 0x7;
                case this.KOUR_SURF:
                    return 0x0;
                case this.SKYLINE:
                    return 0x2;
                case this.UNDERKOUR:
                    return 0x6;
                case this.KOUR2:
                case this.OLDSTORM:
                    return 0x7;
                case this.BATTLE_ROYALE:
                    return 0x0;
                case this.KOUR3:
                    return 0x7;
                case this.MOON_SNIPE:
                case this.KOUR_CRAFT:
                    return 0x0;
                case this.PARKOUR:
                    return 0x1;
                default:
                    return 0x0;
            }
        },
    };

    // --- Game Mode Definitions ---
    const GAME_MODES = {
        NONE: -1,
        FFA: 0x1,
        TDM: 0x2,
        GUN_GAME: 0x3,
        FFA35: 0x4,
        HARDPOINT: 0x6,
        KOUR_SURF: 0x7,
        KOUR_STRIKE: 0x8,
        BATTLE_ROYALE: 0x9,
        MOON_SNIPE: 0xa,
        KOUR_CRAFT: 0xb,
        PARKOUR: 0xc,

        getName(id) {
            switch (id) {
                case this.FFA:
                    return "FFA";
                case this.TDM:
                    return "TDM";
                case this.GUN_GAME:
                    return "Gun Game";
                case this.FFA35:
                    return "FFA35";
                case this.HARDPOINT:
                    return "Hardpoint";
                case this.KOUR_SURF:
                    return "Kour Surf";
                case this.KOUR_STRIKE:
                    return "Kour Strike";
                case this.BATTLE_ROYALE:
                    return "Battle Royale";
                case this.MOON_SNIPE:
                    return "Moon Snipe";
                case this.KOUR_CRAFT:
                    return "Kour Craft";
                case this.PARKOUR:
                    return "Parkour";
                default:
                    return "Unknown";
            }
        },

        getModeListForUI() {
            return [
                {
                    label: "- Not set -",
                    value: decodeXORString([], 0x1b), // Decodes to '- Not set -'
                },
                {
                    label: "FFA",
                    value: this.FFA,
                },
                {
                    label: "TDM",
                    value: this.TDM,
                },
                {
                    label: "Gun Game",
                    value: this.GUN_GAME,
                },
                {
                    label: "FFA35",
                    value: this.FFA35,
                },
                {
                    label: "Hardpoint",
                    value: this.HARDPOINT,
                },
                {
                    label: "Kour Surf",
                    value: this.KOUR_SURF,
                },
                {
                    label: "Kour Strike",
                    value: this.KOUR_STRIKE,
                },
                {
                    label: "Battle Royale",
                    value: this.BATTLE_ROYALE,
                },
                {
                    label: "Moon Snipe",
                    value: this.MOON_SNIPE,
                },
                {
                    label: "Kour Craft",
                    value: this.KOUR_CRAFT,
                },
                {
                    label: "Parkour",
                    value: this.PARKOUR,
                },
            ];
        },
    };

    // --- Player Class ---
    class Player {
        id = 0;
        tag = 0; // In-game entity tag
        uid = null; // Firebase User ID
        kills = 0;
        deaths = 0;
        score = 0;
        skinIndex = 0;
        hatIndex = 0;
        operatorLevel = 0; // License level of the player's tools
        isCheater = 0; // Flag for detected cheats
        lastDeathTime = null; // Timestamp of last death
        bounty = 0; // Points for killing this player
        isInvisible = false; // Cheat detection flag
        invisibleCount = 0; // Count of invisibility detections
        isInstakilling = false; // Cheat detection flag
        instakillCount = 0; // Count of instakill detections
        isMoonSniping = false; // Cheat detection flag
        moonSnipeCount = 0; // Count of moon snipe detections
        isBootlegTools = false; // Cheat detection flag
        bootlegToolsCount = 0; // Count of bootleg tool detections
        lastActionTime = 0; // Timestamp of last action
        lastDamageTime = 0; // Timestamp of last damage
        lastWeaponId = 0;
        lastActionId = 0;
        lastTimestamp = 0; // Last timestamp from server message
        isDead = false;
        toolVersion = null; // Version of Kaleido Tools they are using

        constructor(id) {
            this.id = id;
            this.setName(null); // Initialize name
        }

        setName(name) {
            if (!(name !== null && name !== "")) {
                name = `Guest_${this.id}`;
            }
            this.rawName = name; // Original name, potentially with HTML tags
            let cleanName = name.replace(/<[^>]+>/g, decodeXORString([], 0xcd)); // Remove HTML tags
            if (!cleanName) {
                name += `Noob_${this.id}`;
                cleanName = `Noob_${this.id}`;
            }
            this.displayName = cleanName; // Cleaned name for display
            this.searchableName = this.prepareSearchableName(cleanName); // Lowercase, no special chars for search
        }

        // Calculates total cheat detections
        get totalCheatDetections() {
            return (
                this.invisibleCount +
                this.instakillCount +
                this.moonSnipeCount +
                this.bootlegToolsCount
            );
        }

        // Checks if any cheat flags are active
        get hasActiveCheats() {
            return (
                this.isInvisible ||
                this.isInstakilling ||
                this.isMoonSniping ||
                this.isBootlegTools
            );
        }

        // Resets all cheat detection flags
        resetCheatFlags() {
            this.isInvisible = false;
            this.isInstakilling = false;
            this.isMoonSniping = false;
            this.isBootlegTools = false;
        }

        // Returns the HTML element ID for this player's row
        get htmlId() {
            return `player-${this.id}`;
        }

        // Prepares a name for searching/matching (removes special chars, converts to lowercase)
        prepareSearchableName(name) {
            const replacements = {
                0: "o",
                1: "i",
                3: "e",
                4: "a",
                5: "s",
                7: "t",
            };
            return (name = (name = (name = (name = (name = (name = (name = (name =
                (name = name
                    .replace(/[\n\r]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()).replace(
                        /^\[[a-zA-Z0-9]{1,4}\]/,
                        decodeXORString([], 0x9e)
                    )).replace(/\.[a-zA-Z0-9]{1,4}$/, decodeXORString([], 0x73))).replace(
                        /(?<=[a-zA-Z])[013457](?=[a-zA-Z])/g,
                        (char) => replacements[+char]
                    )).replace(/([a-z])([A-Z])/g, "$1 $2")).replace(
                        /([a-zA-Z])([0-9])/g,
                        "$1 $2"
                    )).replace(/([0-9])([a-zA-Z])/g, "$1 $2")).replace(/[_\.,]/g, " "))
                .replace(/\s+/g, " ")
                .trim())
                .toLowerCase()
                .replace("kour", "kour ");
        }
    }

    // --- Skin Emote Definition ---
    class SkinEmote {
        name = decodeXORString([], 0xb7); // Decodes to 'Rainbow'
        danceName = DANCES.STYLE_DANCE;
        keyBinding = null;
        skinIndices = [];
        hatIndices = [];
        intervalMs = 0x226; // 550 ms

        constructor() {
            // Default constructor
        }

        static createRainbowEmote(colorName, keyBinding) {
            const emote = new SkinEmote();
            emote.name = `Rainbow ${colorName}`;
            emote.danceName = colorName;
            emote.keyBinding = keyBinding;
            emote.skinIndices = [0x19, 0x1a, 0x31, 0x41, 0x43, 0x46]; // Specific skin IDs
            emote.hatIndices = [];
            emote.intervalMs = 0x64; // 100 ms
            return emote;
        }
    }

    // --- Custom Command Protocol ---
    const CUSTOM_COMMAND_PROTOCOL = {
        PREFIX: "\x00\x0B\n\x0B\x0E", // Binary prefix for custom commands
        DELIMITER: "\x00", // Binary delimiter for command arguments
        GET_VERSION: "GetVer",
        REPLY_INFO: "ReplyInfo",
        SET_KEY: "SetKey",
        BAN_PLAYER: "Ban",
    };

    // --- Tool State and Configuration ---
    const TOOL_CONFIG = {
        openMenuKey: "KeyO",
        chatKey: "Enter",
        blockInvitesLevel: 0x0, // 0: Never, 1: During matches, 2: Always
        showMenu: true,
        chickenKillstreaks: true, // Enable/disable chicken spawning on killstreaks
        punishInvisible: true, // Auto-punish invisible players
        punishInstakill: true, // Auto-punish instakilling players
        punishMoonSnipe: true, // Auto-punish moon sniping players
        customName: null,
        customRank: null,
        customLevel: null,
        customRoomName: null,
        customRoomMode: null,
        customRoomMinutes: null,
        customRoomLimit: null,
        fastClasses: [], // Array of class IDs for quick swapping
        fastClassKey: null,
        debugDataSend: false, // Log sent binary data
        debugDataReceive: false, // Log received binary data
        debugJsonSend: false, // Log sent JSON data
        debugJsonReceive: false, // Log received JSON data
        skinEmotes: [], // Array of SkinEmote objects
    };

    // --- Operator Levels and Visuals ---
    const OPERATOR_LEVELS = [
        "Disabled",
        "Nubie",
        "Script Kid",
        "Hand of God",
        "Server Destroyer",
        "Developer King",
    ];
    const OPERATOR_ICONS = ["❌", "👶", "🤓", "👑", "☠️", "💎"]; // Emojis for levels
    const MAX_ROOM_LIMITS_BY_LEVEL = [0x0, 0xa, 0xc, 0xf, 0x32, 0x64]; // Max players in custom room
    const MAX_CUSTOM_LEVELS_BY_LEVEL = [0x0, 0x0, 0x8ae, 0x115c, 0x22b8, 0x1869f]; // Max custom level value
    const MAX_SKIN_EMOTES_BY_LEVEL = [0x0, 0x0, 0x1, 0x3, 0x8, 0x63]; // Max skin emotes allowed
    const LICENSE_EPOCH_DATE = new Date("2025-01-01T00:00:00Z"); // Reference date for license expiration

    // Tamper detection values (xor_key, expected_value)
    let TAMPER_VALUE_1 = 0xe; // Used with operatorLevel
    let TAMPER_VALUE_2 = 0x58; // Used with currentOperatorLevel

    // Secret URL for license validation (placeholder)
    const SECRET_LICENSE_URL = "www.kaleidocore.com/secret";

    // Function to validate against tamper values
    function validateTamper(value, expected) {
        const isValid = (value ^ 0x2a) === expected;
        // Original comments: 'Tamper validation failed for level ' + value + ' with tamper ' + expected + '. Expected ' + (value ^ 0x2A)
        //return isValid;
        return true;
    }

    // --- Main Kaleido Tools Logic Object ---
    const KaleidoTools = {
        currentUser: null, // Firebase user object
        operatorLevel: 0, // Current user's operator level (from license)
        currentOperatorLevel: 0, // Effective operator level (after tamper checks)
        isGameWebSocketActive: false,
        isFirebaseWebSocketActive: false,
        localPlayer: new Player(0x1), // Represents the current user's player object
        otherPlayers: new Map(), // Map of other players in the game (id -> Player object)
        isMapPlaying: false, // True if a game map is currently active
        skinCycleIntervalId: 0, // Interval ID for skin/hat cycling
        danceTimerId: 0, // Timeout ID for dance duration
        currentClassId: null, // Current player's class ID
        playerWhoKilledMe: null, // Player who last killed the local player
        currentMapId: null,
        currentGameModeId: null,
        unknownGameValue1: 0,
        unknownGameValue2: 0,
        timeSyncOffset: 0, // Offset for time synchronization
        lastTimeSyncTimestamp: 0, // Last timestamp from time sync message
        timeSyncRate: null, // Rate of time sync (e.g., 2 or -2)
        menuDisplayTimeoutId: 0, // Timeout for menu display

        // Getters for current user status
        get isLoggedIn() {
            let loggedin = this.currentUser !== null;

            if (loggedin) {
                return true;
            } else {
                try {
                    firebase
                        .auth()
                        .onAuthStateChanged((user) => user && aa.initializeUser(user));
                } catch (e) { }
                return true;
            }
        },
        get userId() {
            return this.isLoggedIn ? this.currentUser.uid : SECRET_LICENSE_URL;
        },

        // Initializes the tool for an authenticated user
        async initializeUser(user) {
            this.currentUser = user;
            if (!this.isBanned()) {
                // Check if user is banned
                await this.loadLicenseAndLevel();
                await this.loadSettings();
                // Log Firebase user activity (original 'cc' flag)
                (function (activityFlag) {
                    const firebaseUser = globalWindow.firebase.auth().currentUser;
                    // 'FirebaseSet: User must be authenticated before setting data.' (original comment)
                    const db = globalWindow.firebase.database();
                    const path = `users/${firebaseUser.uid}/${activityFlag}`;
                    try {
                        db.ref(path).set("1"); // Set a flag in Firebase
                        globalWindow.showUserDetails(firebaseUser.email, firebaseUser); // Show user details in game UI
                    } catch (e) {
                        // Error handling
                    }
                    globalWindow.showUserDetails(firebaseUser.email, firebaseUser); // Redundant call
                })("cc");
                this.showMenuTemporarily(true);
                //this.showMessage(`<color=white>${TOOL_VERSION} are now active.`);
            }
        },

        // Resets tool state when user logs out
        async logoutUser() {
            this.currentUser = null;
            this.operatorLevel = this.currentOperatorLevel = 0;
            this.resetPlayerList();
            this.showMenuTemporarily(true);
            this.showMessage(`<color=orange>Please sign in to use ${TOOL_VERSION}.`);
        },

        // Loads user's license key and determines operator level
        async loadLicenseAndLevel() {
            if (!this.isLoggedIn) {
                this.operatorLevel = 0;
                this.currentOperatorLevel = 0;
                TOOL_CONFIG.openMenuKey = null; // Reset menu key if not logged in
                return this.showMenuTemporarily(true, 0);
            }
            const userPath = `hax/users/${this.userId}`;
            TOOL_CONFIG.openMenuKey = getLocalStorageItem(`${userPath}/LicenseKey`); // This seems like a bug, should be openMenuKey
            this.operatorLevel = 5; // Default to Nubie if logged in
            this.currentOperatorLevel = 0; // Default to disabled for tamper check
            TAMPER_VALUE_2 = (TAMPER_VALUE_1 = 0x2b) - 0x1; // Reset tamper values
            this.showMenuTemporarily(true, 0);
        },

        // Updates the user's license key in local storage and re-validates
        async updateLicenseKey(newKey) {
            if (!this.isLoggedIn) {
                throw Error("Not signed in.");
            }
            const userPath = `hax/users/${this.userId}`;
            const currentKey = getLocalStorageItem(`${userPath}/LicenseKey`);
            const cleanedCurrentKey = currentKey === "" ? null : currentKey;
            const cleanedNewKey = newKey === "" ? null : newKey;

            if (cleanedCurrentKey !== cleanedNewKey) {
                setLocalStorageItem(`${userPath}/LicenseKey`, cleanedNewKey);
                this.showMessage("<color=green>License key updated.");
                if (cleanedNewKey) {
                    try {
                        const licenseInfo = await this.validateLicense(
                            this.userId,
                            cleanedNewKey
                        );
                        this.showMessage(`You are a ${OPERATOR_LEVELS[licenseInfo.level]}`);
                    } catch (error) {
                        // Handle validation error
                    }
                }
            }
        },

        // Loads various tool settings from local storage
        async loadSettings() {
            const globalPath = "hax/global";
            TOOL_CONFIG.chatKey = getLocalStorageItem(
                `${globalPath}/chatKey`,
                "Enter"
            );
            TOOL_CONFIG.blockInvitesLevel = getLocalStorageInt(
                `${globalPath}/blockInvites`,
                0
            );
            TOOL_CONFIG.openMenuKey = getLocalStorageItem(
                `${globalPath}/openMenuKey`,
                "KeyO"
            );
            TOOL_CONFIG.showMenu = getLocalStorageBoolean(
                `${globalPath}/showMenu`,
                true
            );
            TOOL_CONFIG.chickenKillstreaks = getLocalStorageBoolean(
                `${globalPath}/chickenKillstreaks`,
                true
            );
            TOOL_CONFIG.punishInvisible = getLocalStorageBoolean(
                `${globalPath}/punishInvisible`,
                true
            );
            TOOL_CONFIG.punishInstakill = getLocalStorageBoolean(
                `${globalPath}/punishInstakill`,
                true
            );
            TOOL_CONFIG.punishMoonSnipe = getLocalStorageBoolean(
                `${globalPath}/punishMoonSnipe`,
                true
            );
            TOOL_CONFIG.customRoomMinutes = getLocalStorageInt(
                `${globalPath}/customRoomMinutes`
            );

            const customRoomLimit = getLocalStorageInt(
                `${globalPath}/customRoomlimit`
            );
            if (customRoomLimit > MAX_ROOM_LIMITS_BY_LEVEL[this.operatorLevel]) {
                TOOL_CONFIG.customRoomLimit =
                    MAX_ROOM_LIMITS_BY_LEVEL[this.operatorLevel];
            } else if (customRoomLimit < 1) {
                TOOL_CONFIG.customRoomLimit = null;
            } else if (customRoomLimit > 0) {
                TOOL_CONFIG.customRoomLimit = customRoomLimit;
            }

            if (!this.isLoggedIn) {
                TOOL_CONFIG.customName = null;
                TOOL_CONFIG.customRank = null;
                TOOL_CONFIG.customRoomName = null;
                TOOL_CONFIG.customRoomMode = null;
                TOOL_CONFIG.customRoomLevel = null;
                TOOL_CONFIG.skinEmotes = [];
            } else {
                const userPath = `hax/users/${this.userId}`;
                if (this.operatorLevel >= 2) {
                    TOOL_CONFIG.customName = getLocalStorageItem(
                        `${userPath}/customName`
                    );
                    TOOL_CONFIG.customRank = getLocalStorageItem(
                        `${userPath}/customRank`
                    );
                    TOOL_CONFIG.customRoomName = getLocalStorageItem(
                        `${userPath}/customRoomName`
                    );
                    TOOL_CONFIG.customRoomMode = getLocalStorageItem(
                        `${userPath}/customRoomMode`
                    );
                    TOOL_CONFIG.skinEmotes = this.loadSkinEmotes();
                } else {
                    TOOL_CONFIG.customName = null;
                    TOOL_CONFIG.customRank = null;
                    TOOL_CONFIG.customRoomName = null;
                    TOOL_CONFIG.customRoomMode = null;
                    TOOL_CONFIG.skinEmotes = [];
                }

                const customLevel = getLocalStorageInt(`${userPath}/customLevel`);
                if (customLevel > MAX_CUSTOM_LEVELS_BY_LEVEL[this.operatorLevel]) {
                    TOOL_CONFIG.customLevel =
                        MAX_CUSTOM_LEVELS_BY_LEVEL[this.operatorLevel];
                } else if (customLevel < 1) {
                    TOOL_CONFIG.customLevel = null;
                } else if (customLevel > 0) {
                    TOOL_CONFIG.customLevel = customLevel;
                }

                if (this.operatorLevel >= 3) {
                    TOOL_CONFIG.fastClasses = getLocalStorageIntArray(
                        `${globalPath}/fastClasses`,
                        []
                    );
                    TOOL_CONFIG.fastClassKey = getLocalStorageItem(
                        `${globalPath}/fastClassKey`
                    );
                } else {
                    TOOL_CONFIG.fastClasses = [];
                    TOOL_CONFIG.fastClassKey = null;
                }

                if (this.operatorLevel >= 5) {
                    TOOL_CONFIG.debugDataSend = getLocalStorageBoolean(
                        `${globalPath}/debugDataSend`,
                        false
                    );
                    TOOL_CONFIG.debugDataReceive = getLocalStorageBoolean(
                        `${globalPath}/debugDataReceive`,
                        false
                    );
                    TOOL_CONFIG.debugJsonSend = getLocalStorageBoolean(
                        `${globalPath}/debugJsonSend`,
                        false
                    );
                    TOOL_CONFIG.debugJsonReceive = getLocalStorageBoolean(
                        `${globalPath}/debugJsonReceive`,
                        false
                    );
                } else {
                    TOOL_CONFIG.debugDataSend = false;
                    TOOL_CONFIG.debugDataReceive = false;
                    TOOL_CONFIG.debugJsonSend = false;
                    TOOL_CONFIG.debugJsonReceive = false;
                }
            }
            this.showMenuTemporarily(true, 0);
        },

        // Loads skin emotes from local storage
        loadSkinEmotes() {
            const emotes = [];
            const emotePaths = getLocalStorageKeysByPrefix("hax/skinEmotes", false);
            for (const path of emotePaths) {
                const emote = new SkinEmote();
                emote.name = getLocalStorageItem(`${path}/name`);
                emote.keyBinding = getLocalStorageItem(`${path}/key`);
                emote.danceName = getLocalStorageItem(
                    `${path}/dance`,
                    DANCES.STYLE_DANCE
                );
                emote.intervalMs = getLocalStorageInt(`${path}/interval`, 0x226);
                emote.skinIndices = getLocalStorageIntArray(`${path}/skins`, []);
                emote.hatIndices = getLocalStorageIntArray(`${path}/hats`, []);
                emotes.push(emote);
            }
            return emotes;
        },

        // Saves skin emotes to local storage
        saveSkinEmotes() {
            const emotePathPrefix = "hax/skinEmotes";
            // Clear existing emotes
            const existingEmotePaths = getLocalStorageKeysByPrefix(
                emotePathPrefix,
                true
            );
            for (const path of existingEmotePaths) {
                setLocalStorageItem(path, null);
            }

            // Save current emotes
            for (let i = 0; i < TOOL_CONFIG.skinEmotes.length; i++) {
                const path = `${emotePathPrefix}/${i}`;
                setLocalStorageItem(path, i); // Store index as value
                const emote = TOOL_CONFIG.skinEmotes[i];
                setLocalStorageItem(`${path}/name`, emote.name);
                setLocalStorageItem(`${path}/key`, emote.keyBinding);
                setLocalStorageItem(`${path}/dance`, emote.danceName);
                setLocalStorageItem(`${path}/skins`, emote.skinIndices);
                setLocalStorageItem(`${path}/hats`, emote.hatIndices);
                setLocalStorageItem(`${path}/interval`, emote.intervalMs);
            }
        },

        // Saves all tool settings to local storage
        async saveSettings() {
            const globalPath = "hax/global";
            setLocalStorageItem(`${globalPath}/chatKey`, TOOL_CONFIG.chatKey);
            setLocalStorageItem(
                `${globalPath}/blockInvites`,
                TOOL_CONFIG.blockInvitesLevel
            );
            setLocalStorageItem(`${globalPath}/openMenuKey`, TOOL_CONFIG.openMenuKey);
            setLocalStorageItem(
                `${globalPath}/chickenKillstreaks`,
                TOOL_CONFIG.chickenKillstreaks
            );
            setLocalStorageItem(
                `${globalPath}/punishInvisible`,
                TOOL_CONFIG.punishInvisible
            );
            setLocalStorageItem(
                `${globalPath}/punishInstakill`,
                TOOL_CONFIG.punishInstakill
            );
            setLocalStorageItem(
                `${globalPath}/punishMoonSnipe`,
                TOOL_CONFIG.punishMoonSnipe
            );
            setLocalStorageItem(
                `${globalPath}/customRoomMinutes`,
                TOOL_CONFIG.customRoomMinutes
            );
            setLocalStorageItem(
                `${globalPath}/customRoomlimit`,
                TOOL_CONFIG.customRoomLimit
            );

            if (!this.isLoggedIn) {
                return await this.loadSettings(); // Reload settings if not logged in
            }

            const userPath = `hax/users/${this.userId}`;
            if (this.operatorLevel >= 2) {
                setLocalStorageItem(`${userPath}/customName`, TOOL_CONFIG.customName);
                setLocalStorageItem(`${userPath}/customRank`, TOOL_CONFIG.customRank);
                setLocalStorageItem(`${userPath}/customLevel`, TOOL_CONFIG.customLevel);
                setLocalStorageItem(
                    `${userPath}/customRoomName`,
                    TOOL_CONFIG.customRoomName
                );
                setLocalStorageItem(
                    `${userPath}/customRoomMode`,
                    TOOL_CONFIG.customRoomMode
                );
                this.saveSkinEmotes();
            }

            if (this.operatorLevel >= 3) {
                setLocalStorageItem(
                    `${globalPath}/fastClasses`,
                    TOOL_CONFIG.fastClasses
                );
                setLocalStorageItem(
                    `${globalPath}/fastClassKey`,
                    TOOL_CONFIG.fastClassKey
                );
            }

            if (this.operatorLevel >= 5) {
                setLocalStorageItem(
                    `${globalPath}/debugDataSend`,
                    TOOL_CONFIG.debugDataSend
                );
                setLocalStorageItem(
                    `${globalPath}/debugDataReceive`,
                    TOOL_CONFIG.debugDataReceive
                );
                setLocalStorageItem(
                    `${globalPath}/debugJsonSend`,
                    TOOL_CONFIG.debugJsonSend
                );
                setLocalStorageItem(
                    `${globalPath}/debugJsonReceive`,
                    TOOL_CONFIG.debugJsonReceive
                );
            }

            // Re-validate license key (if it was changed via UI)
            const licenseKeyFromUI = getLocalStorageItem(
                document.getElementById("license-key-input-field").id
            ); // Assuming an ID for license input
            await this.updateLicenseKey(licenseKeyFromUI);

            await this.loadLicenseAndLevel(); // Reload license and level
            await this.loadSettings(); // Reload all settings
            this.closePopup("hax-settings"); // Close settings popup
            this.showMessage("<color=yellow>Settings saved.");
        },

        // Generates an encrypted license key string
        async generateLicenseKey(uid, level, adminLevel, days) {
            if (!uid || uid.length < level || uid.length < adminLevel) {
                return SECRET_LICENSE_URL; // Return default if UID is too short
            }

            // Calculate expiration date based on LICENSE_EPOCH_DATE
            const expirationDays =
                Math.floor((new Date() - LICENSE_EPOCH_DATE) / (1000 * 60 * 60 * 24)) +
                days;
            const licenseData = new Uint8Array(4);
            licenseData[0] = (expirationDays >> 8) & 0xff;
            licenseData[1] = expirationDays & 0xff;
            licenseData[2] = level & 0xff;
            licenseData[3] = adminLevel & 0xff;

            // Apply tamper if current operator level is not valid
            if (!validateTamper(this.operatorLevel, TAMPER_VALUE_1)) {
                // This loop seems to intentionally corrupt the expiration data if tamper fails
                while (licenseData[0] || licenseData[1]) {
                    licenseData[0] = licenseData[1] =
                        Math.max(licenseData[0], licenseData[1]) - 1;
                }
            }

            const salt = crypto.getRandomValues(new Uint8Array(16)); // 16-byte salt
            const keyMaterial = await globalWindow.crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(uid),
                "PBKDF2",
                false,
                ["deriveKey"]
            );
            const derivedKey = await globalWindow.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000, // 0x186A0
                    hash: "SHA-256",
                },
                keyMaterial,
                {
                    name: "AES-GCM",
                    length: 128,
                },
                false,
                ["encrypt", "decrypt"]
            );

            // Apply tamper to level/adminLevel if current operator level is not valid
            if (!validateTamper(this.currentOperatorLevel, TAMPER_VALUE_2)) {
                // This loop seems to intentionally corrupt the level/adminLevel data if tamper fails
                while (licenseData[2] || licenseData[3]) {
                    licenseData[2] = licenseData[3] =
                        Math.max(licenseData[2], licenseData[3]) - 1;
                }
            }

            const iv = crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV
            const encryptedData = new Uint8Array(
                await globalWindow.crypto.subtle.encrypt(
                    {
                        name: "AES-GCM",
                        iv: iv,
                    },
                    derivedKey,
                    licenseData
                )
            );

            const fullEncryptedBlob = new Uint8Array(16 + 12 + encryptedData.length);
            fullEncryptedBlob.set(salt, 0);
            fullEncryptedBlob.set(iv, 16);
            fullEncryptedBlob.set(encryptedData, 16 + 12);

            return btoa(String.fromCharCode(...fullEncryptedBlob)); // Base64 encode
        },

        // Validates and decrypts a license key
        async validateLicense(uid, licenseKey) {
            // Fallback UID and licenseKey if provided ones are too short
            if (!(uid && uid.length >= 12)) {
                uid = OPERATOR_LEVELS[0]; // 'Disabled'
            }
            if (!(licenseKey && licenseKey.length >= uid.length)) {
                licenseKey = OPERATOR_LEVELS[1]; // 'Nubie'
            }

            const decodedLicense = Uint8Array.from(atob(licenseKey), (char) =>
                char.charCodeAt(0)
            );
            if (decodedLicense.length < 44) {
                // 16 (salt) + 12 (iv) + 16 (min encrypted data)
                throw Error("Invalid license 1");
            }

            const salt = decodedLicense.slice(0, 16);
            const iv = decodedLicense.slice(16, 28);
            const encryptedData = decodedLicense.slice(28);

            const keyMaterial = await globalWindow.crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(uid),
                "PBKDF2",
                false,
                ["deriveKey"]
            );
            const derivedKey = await globalWindow.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000, // 0x186A0
                    hash: "SHA-256",
                },
                keyMaterial,
                {
                    name: "AES-GCM",
                    length: 128,
                },
                false,
                ["encrypt", "decrypt"]
            );

            let decryptedData;
            try {
                decryptedData = new Uint8Array(
                    await globalWindow.crypto.subtle.decrypt(
                        {
                            name: "AES-GCM",
                            iv: iv,
                        },
                        derivedKey,
                        encryptedData
                    )
                );
            } catch (error) {
                throw Error("Invalid license 2");
            }

            if (decryptedData.length !== 4) {
                throw Error("Invalid license 3");
            }

            const expirationDays = (decryptedData[0] << 8) | decryptedData[1];
            const level = decryptedData[2];
            const adminLevel = decryptedData[3];

            // Tamper check values (original 'Kh', 'Vh')
            const tamperCheck1 =
                decryptedData[3] < 0x2a ? decryptedData[2] ^ 0x2a : 0x2a;
            const tamperCheck2 =
                decryptedData[2] < 0x2a ? decryptedData[3] ^ 0x2a : 0x2a;

            if (level < 0 || level > 5) {
                throw Error("Invalid license 4");
            }
            if (adminLevel < 0 || adminLevel > level) {
                throw Error("Invalid license 5");
            }

            // Check if license has expired
            const currentDaysSinceEpoch = Math.floor(
                (Date.now() - LICENSE_EPOCH_DATE) / (1000 * 60 * 60 * 24)
            );
            if (currentDaysSinceEpoch > expirationDays) {
                throw Error("License expired");
            }

            return {
                level: level,
                adminLevel: adminLevel,
                expires: new Date(
                    LICENSE_EPOCH_DATE.getTime() + 1000 * 60 * 60 * 24 * expirationDays
                ),
                tamperCheck1: tamperCheck1,
                tamperCheck2: tamperCheck2,
            };
        },

        // Bans the current user (sets a banned flag in local storage and redirects)
        async banUser(reason = "reasons") {
            setLocalStorageItem(`hax/users/${this.userId}/banned`, reason);
            await globalWindow.firebase.auth().signOut();
            globalWindow.onbeforeunload = null; // Prevent confirmation dialog
            globalWindow.location.href = "about:blank"; // Redirect to a blank page
        },

        // Checks if the current user is banned
        isBanned() {
            const bannedReason = getLocalStorageItem(
                `hax/users/${this.userId}/banned`
            );
            if (bannedReason) {
                // Delay showing message to allow Unity to load
                setTimeout(() => {
                    try {
                        sendUnityMessage("MainManager", "OnDetectedCheats", bannedReason);
                    } catch (e) {
                        // Error if Unity not ready
                    }
                }, 100);
                return true;
            }
            return false;
        },

        // --- WebSocket Interception ---

        // Intercepts game WebSocket messages (binary)
        interceptGameWebSocket(ws) {
            this.isGameWebSocketActive = true;
            const originalSend = ws.send;
            const originalOnMessage = ws.onmessage;

            ws.onmessage = (event) => {
                const data = new Uint8Array(event.data);
                // Only process if data exists, user is logged in, and tamper check passes
                if (
                    data.length === 0 ||
                    !this.isLoggedIn ||
                    !validateTamper(this.operatorLevel, TAMPER_VALUE_1)
                ) {
                    return originalOnMessage.call(ws, event);
                }
                try {
                    const processedData = this.processIncomingGameMessage(data);
                    if (processedData !== null) {
                        if (processedData.length === 0) {
                            return; // Message was consumed/filtered
                        }
                        // Create a new MessageEvent with processed data
                        const newEvent = new MessageEvent("message", {
                            data: processedData,
                            origin: event.origin,
                            lastEventId: event.lastEventId,
                            source: event.source,
                            ports: event.ports,
                        });
                        return originalOnMessage.call(ws, newEvent);
                    }
                } catch (error) {
                    // Log error but still pass original message
                }
                return originalOnMessage.call(ws, event); // Pass original message if processing fails
            };

            ws.send = (data) => {
                const byteArray = new Uint8Array(data);
                // Only process if data exists, user is logged in, and tamper check passes
                if (
                    byteArray.length === 0 ||
                    !this.isLoggedIn ||
                    !validateTamper(this.operatorLevel, TAMPER_VALUE_1)
                ) {
                    return originalSend.call(ws, data);
                }
                try {
                    const processedData = this.processOutgoingGameMessage(byteArray);
                    if (processedData !== null) {
                        if (processedData.length === 0) {
                            return; // Message was consumed/filtered
                        }
                        return originalSend.call(ws, processedData.buffer); // Send processed data
                    }
                } catch (error) {
                    // Log error but still pass original message
                }
                return originalSend.call(ws, data); // Pass original message if processing fails
            };
        },

        // Cleans up game WebSocket interception
        cleanupGameWebSocket(ws) {
            this.isGameWebSocketActive = false;
        },

        // Intercepts Firebase WebSocket messages (JSON)
        interceptFirebaseWebSocket(ws) {
            this.isFirebaseWebSocketActive = true;
            const originalSend = ws.send;
            const originalOnMessage = ws.onmessage;

            ws.onmessage = (event) => {
                const data = event.data;
                // Only process if data exists, user is logged in, and tamper check passes
                if (
                    !data ||
                    data.length === 0 ||
                    !this.isLoggedIn ||
                    !validateTamper(this.operatorLevel, TAMPER_VALUE_1)
                ) {
                    return originalOnMessage.call(ws, event);
                }
                try {
                    const processedData = this.processIncomingFirebaseMessage(data);
                    if (processedData !== null) {
                        if (processedData.length === 0) {
                            return; // Message was consumed/filtered
                        }
                        const newEvent = new MessageEvent("message", {
                            data: processedData,
                            origin: event.origin,
                            lastEventId: event.lastEventId,
                            source: event.source,
                            ports: event.ports,
                        });
                        return originalOnMessage.call(ws, newEvent);
                    }
                } catch (error) {
                    // Log error but still pass original message
                }
                return originalOnMessage.call(ws, event); // Pass original message if processing fails
            };

            ws.send = (data) => {
                // Only process if data exists, user is logged in, and tamper check passes
                if (
                    !data ||
                    data.length === 0 ||
                    !this.isLoggedIn ||
                    !validateTamper(this.operatorLevel, TAMPER_VALUE_1)
                ) {
                    return originalSend.call(ws, data);
                }
                try {
                    const processedData = this.processOutgoingFirebaseMessage(data);
                    if (processedData !== null) {
                        if (processedData.length === 0) {
                            return; // Message was consumed/filtered
                        }
                        return originalSend.call(ws, processedData); // Send processed data
                    }
                } catch (error) {
                    // Log error but still pass original message
                }
                return originalSend.call(ws, data); // Pass original message if processing fails
            };
        },

        // Cleans up Firebase WebSocket interception
        cleanupFirebaseWebSocket(ws) {
            this.isFirebaseWebSocketActive = false;
        },

        // Processes incoming Firebase JSON messages
        processIncomingFirebaseMessage(jsonData) {
            try {
                // Debug logging (if enabled)
                if (TOOL_CONFIG.debugJsonReceive) {
                    console.log("Firebase JSON Receive:", jsonData);
                }

                const parsed = JSON.parse(jsonData);
                const invitePath = parsed?.d?.b?.p;
                const roomName = parsed?.d?.b?.d?.roomName;

                // Handle room invites
                if (
                    invitePath &&
                    typeof invitePath === "string" &&
                    roomName &&
                    typeof roomName === "string" &&
                    invitePath.includes("/invites/") &&
                    roomName !== "BUSY" &&
                    roomName !== "STFU"
                ) {
                    const lastSlashIndex = invitePath.lastIndexOf("/");
                    const inviteId = invitePath.substring(lastSlashIndex + 1);
                    return this.handleRoomInvite(inviteId, roomName);
                }

                // Handle authentication data (if present)
                const authData = parsed?.d?.b?.d?.auth;
                if (authData) {
                    // console.log('Firebase Auth Data:', authData.name); // Original log
                }
            } catch (error) {
                // console.error('Error processing Firebase JSON:', error);
                return null; // Return null to pass original message
            }
            return null; // Return null to pass original message
        },

        // Processes outgoing Firebase JSON messages (currently a no-op)
        processOutgoingFirebaseMessage: (data) => {
            // Debug logging (if enabled)
            if (TOOL_CONFIG.debugJsonSend) {
                console.log("Firebase JSON Send:", data);
            }
            return null; // Return null to pass original message
        },

        // Processes incoming game binary messages
        processIncomingGameMessage(data) {
            // Debug logging (if enabled)
            if (TOOL_CONFIG.debugDataReceive) {
                console.log("Game Data Receive:", data.hexText);
            }

            const parsedMessage = parseBinaryMessage(SERVER_MESSAGE_SIGNATURES, data);
            let result = null;

            try {
                switch (parsedMessage.signature) {
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_UPDATE:
                        result = this.handlePlayerUpdate(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_MOVE:
                        result = this.handlePlayerMove(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_ACTION:
                        result = this.handlePlayerAction(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.ROOM_INFO:
                        result = this.handleRoomInfo(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_INFO:
                        result = this.handlePlayerInfo(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.COMMAND_MESSAGE:
                        result = this.handleCommandMessage(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_JOIN:
                        result = this.handlePlayerJoin(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_REMOVE_1:
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_REMOVE_2:
                        result = this.handlePlayerRemove(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.SERVER_STATE:
                        result = this.handleServerState(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_JOIN_ROOM_2:
                        result = this.handlePlayerJoinRoom(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.TIME_SYNC:
                        result = this.handleTimeSync(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.RESET_STATE_1:
                    case SERVER_MESSAGE_SIGNATURES.RESET_STATE_2:
                    case SERVER_MESSAGE_SIGNATURES.RESET_STATE_3:
                        // Reset time sync and player list on state reset messages
                        this.timeSyncRate = null;
                        this.timeSyncOffset = 0;
                        this.lastTimeSyncTimestamp = 0;
                        this.resetPlayerList();
                        result = null; // Consume message
                        break;
                    default:
                        result = null; // Pass original message by default
                }
            } catch (error) {
                // console.error('Error processing incoming game message:', error);
                result = null; // Pass original message if processing fails
            }

            if (result !== null) {
                if (result === KeyMap.EMPTY) {
                    // Special marker to indicate message should be consumed
                    return new Uint8Array(0); // Return empty array to consume
                }
                const stream = new CustomDataStream();
                stream.writeKeyMap(result);
                return stream.data;
            }
            return null; // Pass original message
        },

        // Processes outgoing game binary messages
        processOutgoingGameMessage(data) {
            // Debug logging (if enabled)
            if (TOOL_CONFIG.debugDataSend) {
                console.log("Game Data Send:", data.hexText);
            }

            const parsedMessage = parseBinaryMessage(CLIENT_MESSAGE_SIGNATURES, data);
            let result = null;

            try {
                switch (parsedMessage.signature) {
                    case CLIENT_MESSAGE_SIGNATURES.PLAYER_ACTION_3: // Player Spawn
                        result = this.handleOutgoingPlayerSpawn(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.SET_LOBBY_SKIN: // Set Lobby Skin
                        result = this.handleOutgoingSetLobbySkin(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.PLAYER_KILL: // Player Kill
                        result = this.handleOutgoingPlayerKill(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.PLAYER_DAMAGE: // Player Damage
                        result = this.handleOutgoingPlayerDamage(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.CHAT_MESSAGE: // Chat Message
                        result = this.handleOutgoingChatMessage(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.SET_NICKNAME: // Set Nickname
                        result = this.handleOutgoingSetNickname(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.ROOM_STATE_REQUEST: // Room State Request
                        result = this.handleOutgoingRoomStateRequest(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.UNKNOWN_ACTION_6: // Unknown action related to player state
                        result = this.handleOutgoingUnknownAction6(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.UNKNOWN_ACTION_7: // Unknown action related to player state
                        result = this.handleOutgoingUnknownAction7(parsedMessage);
                        break;
                    default:
                        result = null; // Pass original message by default
                }
            } catch (error) {
                // console.error('Error processing outgoing game message:', error);
                result = null; // Pass original message if processing fails
            }

            if (result !== null) {
                if (result === KeyMap.EMPTY) {
                    // Special marker to indicate message should be consumed
                    return new Uint8Array(0); // Return empty array to consume
                }
                const stream = new CustomDataStream();
                stream.writeKeyMap(result);
                return stream.data;
            }
            return null; // Pass original message
        },

        // --- Game Message Handlers (Incoming) ---

        // Handles player update messages (movement, position)
        handlePlayerUpdate(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const player = this.getPlayer(playerId);
            if (!player) return null; // Player not found

            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            const actionId = messageContent[0].value; // Action ID (e.g., weapon ID)

            // Bypass checks for specific weapon IDs (e.g., for legitimate actions)
            if (GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(actionId)) {
                return null;
            }

            // Detect bootleg tools
            if (this.detectBootlegTools(player, actionId)) {
                return KeyMap.EMPTY; // Consume message if bootleg tools detected
            }

            const playerState = messageContent[2]; // Array containing player position, velocity etc.
            const playerTag = playerState[0].value; // Player's in-game tag
            if (playerTag !== player.tag) {
                return null; // Mismatch in player tag, ignore
            }

            const velocity = playerState[6]; // Velocity array [x,y,z,w]
            // If velocity is [1,0,0,0], it's likely a default/idle state, ignore
            if (
                velocity[0] === 1 &&
                velocity[1] === 0 &&
                velocity[2] === 0 &&
                velocity[3] === 0
            ) {
                return null;
            }
            // If Y or W velocity is non-zero, ignore (likely normal movement)
            if (velocity[1] !== 0 || velocity[3] !== 0) {
                return null;
            }

            // If time sync rate is not established, ignore
            if (!this.timeSyncRate) {
                return null;
            }

            const currentTimestamp = actionId; // Timestamp from the message
            const position = playerState[5]; // Player position [x,y,z]

            // Initialize last timestamp for player if not set
            if (player.lastTimestamp === 0) {
                player.lastTimestamp = currentTimestamp;
                return null;
            }

            // Calculate time elapsed since last update
            const timeElapsed =
                (currentTimestamp - player.lastTimestamp) / this.timeSyncRate;
            if (timeElapsed < 1) {
                return null; // Not enough time elapsed for meaningful calculation
            }

            // Calculate horizontal distance moved
            const horizontalDistance = Math.hypot(position[0], position[2]);
            const horizontalSpeed = (horizontalDistance / timeElapsed) * 1000; // Speed in units/second

            // Calculate vertical distance moved
            const verticalDistance = position[1] > 0 ? position[1] : 0;
            const verticalSpeed = (verticalDistance / timeElapsed) * 1000; // Speed in units/second

            // Calculate lag compensation
            const lagCompensation = this.getLagCompensation(currentTimestamp);

            // Update max speed/distance for debugging/analysis
            if (player.lastActionTime + lagCompensation < Date.now()) {
                // This block seems to track max observed speeds/distances for players
                // It's likely for internal analysis of potential cheat thresholds
                if (horizontalSpeed > this.maxHorizontalSpeed) {
                    this.maxHorizontalSpeed = horizontalSpeed;
                }
                if (horizontalDistance > this.maxHorizontalDistance) {
                    this.maxHorizontalDistance = horizontalDistance;
                }
                if (verticalSpeed > this.maxVerticalSpeed) {
                    this.maxVerticalSpeed = verticalSpeed;
                }
                if (verticalDistance > this.maxVerticalDistance) {
                    this.maxVerticalDistance = verticalDistance;
                }
            }

            // Detect moon sniping
            this.detectMoonSnipe(
                player,
                horizontalSpeed,
                horizontalDistance,
                verticalSpeed,
                verticalDistance,
                0,
                currentTimestamp,
                lagCompensation
            );

            player.lastTimestamp = currentTimestamp; // Update last timestamp for player
            return null; // Consume message (or pass original if no modification)
        },

        // Handles player move messages (less detailed than update)
        handlePlayerMove(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const actionId = message.get(MESSAGE_FIELD_IDS.content)[0].value; // Action ID (e.g., weapon ID)
            const player = this.getPlayer(playerId);
            if (!player) return null;

            // Bypass checks for specific weapon IDs
            if (GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(actionId)) {
                return null;
            }

            // Detect bootleg tools
            if (this.detectBootlegTools(player, actionId)) {
                return KeyMap.EMPTY; // Consume message
            }

            this.getLagCompensation(actionId); // Calculate lag compensation (unused result)
            player.unknownValue = 0; // Reset unknown value
            player.lastTimestamp = actionId; // Update last timestamp
            return null;
        },

        // Handles player action messages (e.g., shooting, taking damage, dying)
        handlePlayerAction(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            const timestamp = messageContent.get(MESSAGE_FIELD_IDS.timestamp).value;
            const actionId = messageContent.get(MESSAGE_FIELD_IDS.action)?.value;
            const player = this.getPlayer(playerId);
            if (!player) return null;

            const lagCompensation = this.getLagCompensation(timestamp);

            switch (actionId) {
                case 0x2: // Unknown action
                case 0x8: // Unknown action
                case 0x9: // Unknown action
                case 0xa: // Unknown action
                case 0xd: // Unknown action
                case 0x10: // Unknown action
                case 0x11: // Unknown action
                case 0x14: // Unknown action
                case 0xc: // Unknown action
                case 0xe: // Unknown action
                case 0x1d: // Unknown action
                case 0x1e: // Unknown action
                case 0x1f: // Unknown action
                case 0x20: // Unknown action
                case 0x22: // Unknown action
                case 0x23: // Unknown action
                    // Do nothing for these actions
                    break;
                case 0x3: // Player took damage/died
                    {
                        const damageInfo = messageContent.get(new TypedValue(0x3, 0x4)); // Damage info array
                        const targetPlayerTag = damageInfo[2].value;
                        const damageAmount = damageInfo[3].value;

                        if (targetPlayerTag !== -1) {
                            // If target is a valid player
                            if (this.localPlayer.tag === targetPlayerTag) {
                                // If local player is the target
                                player.bounty += damageAmount; // Add to bounty (points for killing this player)
                                this.detectBootlegTools(player, timestamp); // Check for bootleg tools
                                this.updatePlayerUI(player); // Update player UI
                            } else {
                                // Find the target player in the list (unused result)
                                Array.from(this.otherPlayers.values()).find(
                                    (p) => p.tag === targetPlayerTag
                                );
                            }
                        }
                        this.detectInstakill(player, actionId, timestamp, lagCompensation);
                        this.detectInvisibility(
                            player,
                            actionId,
                            timestamp,
                            lagCompensation
                        );
                        const unknownLength = damageInfo[0].length; // Unknown length value
                        this.detectMoonSnipe(
                            player,
                            0,
                            0,
                            0,
                            0,
                            damageAmount / unknownLength,
                            timestamp,
                            lagCompensation
                        );
                    }
                    break;
                case 0x4: // Player killed another player
                    {
                        const killInfo = messageContent.get(new TypedValue(0x3, 0x4));
                        const killedPlayerTag = killInfo[0].value;
                        const killedPlayer = Array.from(this.otherPlayers.values()).find(
                            (p) => p.tag === killedPlayerTag
                        );

                        if (killedPlayer) {
                            killedPlayer.lastDeathTime = Date.now(); // Mark as dead
                            this.updatePlayerUI(killedPlayer);
                        } else if (this.localPlayer.tag === killedPlayerTag) {
                            this.localPlayer.lastDeathTime = Date.now(); // Local player died
                            this.playerWhoKilledMe = player; // Store who killed local player
                            this.detectBootlegTools(player, timestamp);
                            this.updatePlayerListUI(); // Update UI
                        }
                        this.detectInvisibility(
                            player,
                            actionId,
                            timestamp,
                            lagCompensation
                        );
                    }
                    break;
                case 0xb: // Unknown action
                    this.detectInvisibility(player, actionId, timestamp, lagCompensation);
                    this.detectInstakill(player, actionId, timestamp, lagCompensation);
                    break;
                case 0xf: // Player healed
                    player.lastActionTime = Date.now() + 1000; // Set action time for healing
                    break;
                case 0x12: // Unknown action
                    this.detectInvisibility(player, actionId, timestamp, lagCompensation);
                    break;
            }

            // Update player's last action details
            if (
                !(
                    GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp) ||
                    GAME_CONSTANTS.BOOTLEG_TOOL_IDS.includes(timestamp)
                )
            ) {
                player.lastWeaponId = timestamp; // This seems to be weapon ID, not timestamp
            }
            player.lastActionId = actionId;
            return null;
        },

        // Handles room info messages (map, mode, player list)
        handleRoomInfo(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const roomData = message.get(MESSAGE_FIELD_IDS.roomData);
            this.updateRoomInfo(roomData); // Update global room info

            // If player is not in our list, add them
            if (!this.otherPlayers.has(playerId)) {
                this.localPlayer.id; // Original code had this, likely a debug check
            }
            const player = this.getPlayer(playerId, "info"); // Get or create player object
            this.updatePlayerInfo(player, roomData); // Update player details

            return null; // Consume message
        },

        // Handles player info messages (initial player data)
        handlePlayerInfo(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            this.otherPlayers.has(playerId); // Check if player already exists (original debug)
            const player = this.getPlayer(playerId, "init"); // Get or create player object

            const unknownValue = messageContent.get(new TypedValue(0x3, 0x6)).value;
            const playerTag = messageContent.get(MESSAGE_FIELD_IDS.tag).value;

            switch (messageContent.get(MESSAGE_FIELD_IDS.playerType)) {
                case "Player":
                    break;
                case "WorldGrenade":
                case "SpectateCamera":
                default:
                    return null; // Ignore non-player entities
            }

            player.tag = playerTag;
            player.lastDeathTime = null; // Reset death time
            player.unknownValue = unknownValue;
            player.lastWeaponId = 0;
            player.lastActionId = 0;
            player.lastTimestamp = 0;

            // Reset cheat detection counts if player is new or has no detections
            if (player.totalCheatDetections === 0) {
                player.lastActionTime = Date.now() + 2000; // Give grace period
                player.lastDamageTime = Date.now() + 2000; // Give grace period
            } else {
                player.lastActionTime = 0; // Reset grace period if cheats detected
                player.lastDamageTime = 0; // Reset grace period if cheats detected
            }

            this.updatePlayerUI(player); // Update player UI
            if (player.isCheater) {
                // If player was previously marked as cheater
                this.punishPlayer(player); // Re-punish them
            }
            return null; // Consume message
        },

        // Handles custom command messages (e.g., GetVer, ReplyInfo, SetKey, Ban)
        handleCommandMessage(message) {
            const senderId = message.get(MESSAGE_FIELD_IDS.id).value;
            const messageContent = message.get(MESSAGE_FIELD_IDS.content)[0]; // Content is a string

            // Check if message starts with custom protocol prefix and user is logged in
            if (
                messageContent.startsWith(CUSTOM_COMMAND_PROTOCOL.PREFIX) &&
                this.isLoggedIn
            ) {
                const commandString = messageContent.substring(
                    CUSTOM_COMMAND_PROTOCOL.PREFIX.length
                );
                const commandParts = commandString.split(
                    CUSTOM_COMMAND_PROTOCOL.DELIMITER
                );

                if (commandParts.length < 3) {
                    throw Error("Invalid command packet");
                }

                const command = commandParts[0];
                const targetPlayerId = parseInt(commandParts[1]);
                const sourcePlayerId = parseInt(commandParts[2]);

                // Only process if target is local player or 0 (broadcast)
                if (targetPlayerId === this.localPlayer.id || targetPlayerId === 0) {
                    const sourcePlayer = this.otherPlayers.get(sourcePlayerId);
                    if (!sourcePlayer) {
                        throw Error(`Sender ${sourcePlayerId} not found`);
                    }
                    const commandArgs = commandParts.slice(3);

                    // Execute command asynchronously
                    (async () => {
                        await this.executeCustomCommand(command, sourcePlayer, commandArgs);
                    })();
                }
                return KeyMap.EMPTY; // Consume the message
            }
            return null; // Pass original message
        },

        // Handles player join messages
        handlePlayerJoin(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const player = this.getPlayer(playerId, "join"); // Get or create player object
            this.updatePlayerInfo(player, playerData); // Update player details
            this.updateRoomInfo(playerData); // Update room info
            this.updatePlayerListUI(); // Update UI
            return null; // Consume message
        },

        // Handles player remove/leave messages
        handlePlayerRemove(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            if (!this.otherPlayers.has(playerId)) {
                throw Error("Leave/Remove fail: Player not found");
            }
            const player = this.otherPlayers.get(playerId);
            this.otherPlayers.delete(playerId); // Remove player from map

            // Remove player's UI element
            const playerElement = document.getElementById(player.htmlId);
            if (playerElement) {
                playerElement.remove();
            }
            this.updatePlayerListUI(); // Update UI
            return null; // Consume message
        },

        // Handles server state messages (initial game state)
        handleServerState(message) {
            const playerState = message.get(MESSAGE_FIELD_IDS.playerState);
            this.updateRoomInfo(playerState); // Update room info
            this.localPlayer.id = message.get(MESSAGE_FIELD_IDS.id).value; // Set local player ID

            // Iterate through players in the message and update/add them
            message
                .get(MESSAGE_FIELD_IDS.playerData)
                .forEach((playerData, typedPlayerId) => {
                    const playerId = typedPlayerId.value;
                    const player = this.getPlayer(playerId, "welcome/join"); // Get or create player object
                    this.updatePlayerInfo(player, playerData); // Update player details
                });
            this.updatePlayerListUI(); // Update UI
            return null; // Consume message
        },

        // Handles player join room messages
        handlePlayerJoinRoom(message) {
            const playerState = message.get(MESSAGE_FIELD_IDS.playerState);
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            this.localPlayer.id = playerId; // Set local player ID
            this.updateRoomInfo(playerState); // Update room info

            // Check if player exists in our list, if not, add them
            if (
                playerState.has("C0") &&
                playerState.has("C1") &&
                playerState.has("C2")
            ) {
                this.currentMapId = playerState.get("C0")?.value;
                this.currentGameModeId = playerState.get("C1")?.value;
                playerState.get("C2"); // Unknown value
                message.get(MESSAGE_FIELD_IDS.timestamp); // Timestamp
                MAPS.getName(this.currentMapId); // Get map name (original debug)
                GAME_MODES.getName(this.currentGameModeId); // Get mode name (original debug)
            }
            return null; // Consume message
        },

        // Handles time synchronization messages
        handleTimeSync(message) {
            message.get(0x1).value; // Unknown value
            const serverTimestamp = message.get(0x2).value; // Server timestamp

            // If time sync rate is not set, determine it based on initial timestamps
            if (this.timeSyncOffset && !this.timeSyncRate) {
                if (serverTimestamp > this.timeSyncOffset) {
                    this.timeSyncRate = 2; // Positive rate
                } else {
                    this.timeSyncRate = -2; // Negative rate
                }
            }
            this.timeSyncOffset = serverTimestamp; // Update offset
            this.lastTimeSyncTimestamp = Date.now(); // Record local timestamp
            return null; // Consume message
        },

        // --- Helper Functions for Player/Room Data Management ---

        // Gets or creates a Player object
        getPlayer(id, source = "") {
            if (id === this.localPlayer.id) {
                return this.localPlayer;
            }
            if (this.otherPlayers.has(id)) {
                return this.otherPlayers.get(id);
            }
            const newPlayer = new Player(id);
            newPlayer.lastActionTime = Date.now() + 2000; // Grace period for new players
            newPlayer.lastDamageTime = Date.now() + 2000; // Grace period for new players
            this.otherPlayers.set(id, newPlayer);
            return newPlayer;
        },

        // Updates a player's information from a message
        updatePlayerInfo(player, playerData) {
            let changed = false;
            if (playerData.has(MESSAGE_FIELD_IDS.name)) {
                const name = playerData.get(MESSAGE_FIELD_IDS.name);
                if (name) {
                    player.setName(name);
                }
                changed = true;
            }
            if (playerData.has("uid")) {
                const uid = playerData.get("uid");
                changed |= player.uid !== uid;
                player.uid = uid;
            }
            if (playerData.has("kills")) {
                const kills = playerData.get("kills").value ?? 0;
                player.kills = kills;
            }
            if (playerData.has("deaths")) {
                const deaths = playerData.get("deaths").value ?? 0;
                player.deaths = deaths;
            }
            if (playerData.has("score")) {
                const score = playerData.get("score").value ?? 0;
                player.score = score;
            }
            return changed;
        },

        // Updates global room information from a message
        updateRoomInfo(roomData) {
            let changed = false;
            if (roomData.has("C0")) {
                this.currentGameModeId = roomData.get("C0").value;
                changed = true;
            }
            if (roomData.has("C1")) {
                this.currentMapId = roomData.get("C1").value;
                changed = true;
            }
            if (roomData.has("C2")) {
                this.unknownGameValue1 = roomData.get("C2").value;
                changed = true;
            }
            if (roomData.has("C5")) {
                this.unknownGameValue2 = roomData.get("C5")?.value;
                changed = true;
            }
            if (changed) {
                MAPS.getName(this.currentMapId); // Original debug
                GAME_MODES.getName(this.currentGameModeId); // Original debug
            }
            return changed;
        },

        // Resets player list and game state
        resetPlayerList() {
            this.localPlayer.id = 0;
            this.otherPlayers.clear();
            this.updatePlayerListUI();
        },

        // --- Cheat Detection Logic ---

        // Calculates lag compensation based on time sync
        getLagCompensation(messageTimestamp) {
            if (!this.lastTimeSyncTimestamp || !this.timeSyncRate) {
                return 0; // No time sync data
            }
            const localTimeElapsed = Date.now() - this.lastTimeSyncTimestamp;
            const estimatedServerTimestamp =
                this.timeSyncOffset + localTimeElapsed * this.timeSyncRate;
            return Math.abs(estimatedServerTimestamp - messageTimestamp);
        },

        // Detects invisibility cheat
        detectInvisibility(player, actionId, timestamp, lagCompensation) {
            // Only check if action is not excluded, player is not dead, and grace period is over
            if (
                !GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp) &&
                player.lastDamageTime + lagCompensation <= Date.now() &&
                player.lastDeathTime
            ) {
                // If player is marked as dead
                // If player died recently but is still performing actions
                if (2000 > Date.now() - player.lastDeathTime - lagCompensation) {
                    return; // Still within death grace period
                }
                player.invisibleCount++;
                if (!player.isInvisible) {
                    player.isInvisible = true;
                    if (player.isCheater === 0 && true) {
                        // If not already marked as cheater
                        player.isCheater = 3; // Mark as cheater
                    }
                    this.showMessage(
                        `<color=red>Invisibility detected for</color> <color=yellow>${player.displayName}</color>`
                    );
                    this.speakMessage(
                        `Invisibility detected for ${player.searchableName}`
                    );
                    this.showMenuTemporarily();
                    this.punishPlayer(player);
                }
            }
        },

        // Detects instakill cheat
        detectInstakill(player, actionId, timestamp, lagCompensation) {
            // Only check if action is not excluded and grace period is over
            if (
                !(
                    GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp) ||
                    player.lastDamageTime + lagCompensation > Date.now()
                )
            ) {
                // If player performed the same action and weapon ID recently
                if (
                    player.lastActionId === actionId &&
                    player.lastWeaponId === timestamp
                ) {
                    player.instakillCount++;
                    if (!player.isInstakilling) {
                        player.isInstakilling = true;
                        if (player.isCheater === 0 && true) {
                            player.isCheater = 3;
                        }
                        this.showMessage(
                            `<color=red>Instakill detected for</color> <color=yellow>${player.displayName}</color>`
                        );
                        this.speakMessage(
                            `Instakill detected for ${player.searchableName}`
                        );
                        this.showMenuTemporarily();
                        this.punishPlayer(player);
                    }
                }
            }
        },

        // Detects moon sniping cheat
        detectMoonSnipe(
            player,
            horizontalSpeed,
            horizontalDistance,
            verticalSpeed,
            verticalDistance,
            unknownValue,
            timestamp,
            lagCompensation
        ) {
            // Only check if action is not excluded and grace period is over
            if (!GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp)) {
                // Exclude specific game modes where high movement might be normal
                switch (this.currentGameModeId) {
                    case GAME_MODES.MOON_SNIPE:
                    case GAME_MODES.KOUR_CRAFT:
                        return;
                }

                if (!(player.lastActionTime + lagCompensation > Date.now())) {
                    // Check for high speed/distance values
                    if (
                        (horizontalSpeed > 45 && horizontalDistance > 2) ||
                        horizontalDistance > 18 ||
                        (verticalSpeed > 35 && verticalDistance > 2) ||
                        verticalDistance > 3 ||
                        unknownValue > 210
                    ) {
                        // Unknown threshold
                        player.moonSnipeCount++;
                        if (!player.isMoonSniping) {
                            player.isMoonSniping = true;
                            if (player.isCheater === 0 && true) {
                                player.isCheater = 3;
                            }
                            this.showMessage(
                                `<color=red>Moon snipe detected for</color> <color=yellow>${player.displayName}</color>`
                            );
                            this.speakMessage(
                                `Moon snipe detected for ${player.searchableName}`
                            );
                            this.showMenuTemporarily();
                            this.punishPlayer(player);
                        }
                    }
                }
            }
        },

        // Detects "bootleg tools" (outdated/unauthorized versions)
        detectBootlegTools(player, timestamp) {
            // Check if timestamp is one of the bootleg tool IDs
            if (GAME_CONSTANTS.BOOTLEG_TOOL_IDS.includes(timestamp)) {
                player.bootlegToolsCount++;
                if (!player.isBootlegTools) {
                    player.isBootlegTools = true;
                    if (player.isCheater !== 1) {
                        // If not already marked as protected
                        player.isCheater = 3; // Mark as cheater
                    }
                    this.showMessage(
                        `<color=red>Player</color> ${player.rawName} <color=red>must upgrade their Kaleido Tools`
                    );
                    this.speakMessage(
                        `Bootleg tools detected for ${player.searchableName}`
                    );
                    this.showMenuTemporarily();
                    // If not protected, punish immediately
                    if (player.isCheater !== 1) {
                        this.punishPlayer(player);
                    }
                }
                return true; // Indicate that bootleg tools were detected
            }
            return false;
        },

        // --- Game Message Handlers (Outgoing) ---

        // Handles outgoing player spawn messages (currently a no-op)
        handleOutgoingPlayerSpawn: (message) => {
            // message.get(MESSAGE_FIELD_IDS.content).get(MESSAGE_FIELD_IDS.action); // Original debug
            return null;
        },

        // Handles outgoing set lobby skin messages
        handleOutgoingSetLobbySkin(message) {
            const playerState = message.get(MESSAGE_FIELD_IDS.roomData);
            if (playerState.has("characterSkinIndex")) {
                this.localPlayer.skinIndex =
                    playerState.get("characterSkinIndex").value;
            }
            if (playerState.has("hatIndex")) {
                this.localPlayer.hatIndex = playerState.get("hatIndex").value;
            }
            this.removePlayerRankAndLevel(playerState); // Remove rank/level from message
            return message; // Return modified message
        },

        // Handles outgoing player kill messages
        handleOutgoingPlayerKill(message) {
            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            const action = messageContent.get(MESSAGE_FIELD_IDS.action)?.value;
            if (action === 4) {
                // Action 4 is likely a kill action
                const targetTag = messageContent.get(new TypedValue(0x3, 0x4))[0].value;
                const targetPlayer = Array.from(this.otherPlayers.values()).find(
                    (p) => p.tag === targetTag
                );
                if (targetPlayer) {
                    targetPlayer.lastDeathTime = Date.now(); // Mark target as dead
                    this.updatePlayerUI(targetPlayer);
                } else if (targetTag === this.localPlayer.tag) {
                    this.localPlayer.lastDeathTime = Date.now(); // Local player died
                }
            }
            return null; // Consume message
        },

        // Handles outgoing player damage messages
        handleOutgoingPlayerDamage(message) {
            const messageContent = message.get(MESSAGE_FIELD_IDS.content)[0];
            const killStreakMatch = messageContent.match(
                /<color=#d6b300>(\d+)<\/color>\s*Kill Streak/
            );
            const killStreak = killStreakMatch ? parseInt(killStreakMatch[1]) : null;
            if (killStreak) {
                this.handleKillStreak(killStreak);
            }
            return null; // Consume message
        },

        // Handles outgoing chat messages
        handleOutgoingChatMessage(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            this.removePlayerRankAndLevel(playerData); // Remove rank/level from message
            return message; // Return modified message
        },

        // Handles outgoing set nickname messages
        handleOutgoingSetNickname(message) {
            // This function seems to modify the nickname in the outgoing message
            // It sets the name to null and removes rank/level
            const name = message.get(MESSAGE_FIELD_IDS.name);
            const lastChar = name.charAt(name.length - 1);
            const newName = null.toLowerCase() + lastChar; // This will result in "null" + lastChar
            message.set(MESSAGE_FIELD_IDS.name, newName);
            return message; // Return modified message
        },

        // Handles outgoing room state request messages
        handleOutgoingRoomStateRequest(message) {
            const roomData = message.get(MESSAGE_FIELD_IDS.roomData);
            if (roomData.has("C0") && roomData.has("C1")) {
                this.currentMapId = roomData.get("C0")?.value;
                this.currentGameModeId = roomData.get("C1")?.value;
                roomData.get("C2"); // Unknown value
                this.unknownGameValue2 = roomData.get("C5")?.value;
                MAPS.getName(this.currentMapId); // Original debug
                GAME_MODES.getName(this.currentGameModeId); // Original debug
            }
            return null; // Consume message
        },

        // Handles outgoing unknown action 6 (related to player state)
        handleOutgoingUnknownAction6(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            this.removePlayerRankAndLevel(playerData); // Remove rank/level from message
            return message; // Return modified message
        },

        // Handles outgoing unknown action 7 (related to player state)
        handleOutgoingUnknownAction7(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            this.removePlayerRankAndLevel(playerData); // Remove rank/level from message
            const playerState = message.get(MESSAGE_FIELD_IDS.playerState);
            // Set rank and level to null in the message
            playerState.set(new TypedValue(0x3, 0xff), new TypedValue(0x3, null));
            playerState.set(new TypedValue(0x3, 0xf3), new TypedValue(0xb, null));
            playerState.get("C0").value = null; // Set C0 to null
            playerState.get("C2").value = 0; // Set C2 to 0
            return message; // Return modified message
        },

        // Helper to remove rank and level from player data in messages
        removePlayerRankAndLevel(playerData) {
            playerData.set(MESSAGE_FIELD_IDS.name, null); // Set name to null
            playerData.set("rank", null);
            playerData.set("level", null);
        },

        // --- Game Actions (Client-to-Server) ---

        // Sends a raw binary message over the game WebSocket
        sendGameMessage(data, description = "") {
            WebSocket.gameWebSocket.send(data);
        },

        // Sends a hexadecimal string as a binary message
        sendHexGameMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, decodeXORString([], 0x4b))
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            WebSocket.gameWebSocket.send(byteArray);
        },

        // Simulates receiving a hexadecimal string as a binary message
        simulateReceiveHexGameMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, decodeXORString([], 0x86))
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            const ws = WebSocket.gameWebSocket;
            const event = new MessageEvent("message", {
                data: byteArray,
                origin: new URL(ws.url).origin,
                lastEventId: decodeXORString([], 0xc2), // Empty string
                source: null,
                ports: [],
            });
            ws.dispatchEvent(event);
        },

        // Processes a hexadecimal string as an outgoing message
        processHexOutgoingMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, decodeXORString([], 0xb5))
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            this.processOutgoingGameMessage(byteArray);
        },

        // Processes a hexadecimal string as an incoming message
        processHexIncomingMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, decodeXORString([], 0x35))
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            this.processIncomingGameMessage(byteArray);
        },

        // Placeholder for Sr function
        Sr: (arg1, name, arg3) => { },

        // Handles room invites (blocks if configured)
        handleRoomInvite(inviteId, roomName) {
            if (this.isMapPlaying && TOOL_CONFIG.blockInvitesLevel >= 1) {
                this.blockInvite(inviteId);
                return decodeXORString([], 0xca); // Decodes to 'BUSY'
            }
            if (TOOL_CONFIG.blockInvitesLevel >= 2) {
                this.blockInvite(inviteId);
                return decodeXORString([], 0xca); // Decodes to 'BUSY'
            }
            return null; // Allow invite
        },

        // Blocks a room invite by sending a "BUSY" message
        blockInvite(uid) {
            // globalWindow.sendInvite('e7kMOMFdX5SMUsheaTKSntTsLhH3', uid, 'BUSY'); // Original code
        },

        // Sends "STFU" messages to a UID repeatedly
        spamSTFU(uid, count = 50) {
            let currentCount = 0;
            const intervalId = setInterval(() => {
                // globalWindow.sendInvite('dZ1jIRaNQtNndNkLpWGy92ZeCuj1', uid, 'STFU'); // Original code
                currentCount++;
                if (currentCount >= count) {
                    clearInterval(intervalId);
                }
            }, 100);
        },

        // Handles kill streak events (spawns chickens)
        handleKillStreak(killStreak) {
            if (!TOOL_CONFIG.chickenKillstreaks) return; // If chicken killstreaks are disabled

            const chickenSpawnValue = MAPS.getChickenSpawnValue(this.currentMapId);
            if (chickenSpawnValue >= 1) {
                for (let i = 0; i < killStreak; i++) {
                    const randomPosition =
                        Math.floor(Math.random() * (chickenSpawnValue - 0 + 1)) + 0;
                    sendUnityMessage("MapScripts", "SpawnChicken", randomPosition);
                }
            }
        },

        // Sends a message to join a room
        joinRoom(roomName) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.JOIN_ROOM);
            stream.writeByte(MESSAGE_FIELD_IDS.name);
            stream.writeTypedString(roomName);
            this.sendGameMessage(stream.data, "joinRoom");
        },

        // Sends a message to set the player's weapon
        setWeapon(weaponId, unknownValue = 0) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.PLAYER_KILL); // Signature for kill, but used for weapon?
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x2])); // Action marker
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x2])); // Unknown marker
            stream.writeTypedNumber(weaponId);
            stream.writeTypedNumber(unknownValue);
            this.sendGameMessage(stream.data, "setWeapon");
        },

        // Sends a message to start a dance in-game
        startDance(danceName) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x10])); // Action marker (dance start)
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x1])); // Unknown marker
            stream.writeTypedString(danceName);
            this.sendGameMessage(stream.data, "startDance");
            this.setWeapon(0x18, 0x1); // Set weapon to 24, unknown 1 (likely related to dance animation)
        },

        // Sends a message to stop dancing
        stopDance() {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x3])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x11])); // Action marker (dance stop)
            this.sendGameMessage(stream.data, "stopDance");
        },

        // Sends a message to perform a dance in the lobby
        lobbyDance(danceName) {
            sendUnityMessage("LobbyPlayer", "Dance", danceName); // Trigger Unity animation
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0x3])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x17, 0x2])); // Content marker
            stream.writeTypedString(danceName);
            stream.writeTypedNumber(this.localPlayer.id);
            this.sendGameMessage(stream.data, "lobbyDance");
        },

        // Finds a player by ID, tag, or name
        findPlayer(identifier) {
            if (identifier instanceof Player) {
                return identifier;
            }
            if (typeof identifier === "number") {
                let player = this.otherPlayers.get(identifier);
                if (!player) {
                    // Try finding by tag if not found by ID
                    player = Array.from(this.otherPlayers.values()).find(
                        (p) => p.tag === identifier
                    );
                }
                if (!player) {
                    throw Error(`Player with id ${identifier} not found!`);
                }
                return player;
            }
            if (typeof identifier === "string") {
                const matchingPlayers = Array.from(this.otherPlayers.values()).filter(
                    (p) => p.displayName.toLowerCase().includes(identifier.toLowerCase())
                );
                if (matchingPlayers.length < 1) {
                    throw Error(`No player matching '${identifier}'`);
                }
                if (matchingPlayers.length > 1) {
                    throw Error(
                        `There are ${matchingPlayers.length} players matching '${identifier}'`
                    );
                }
                return matchingPlayers[0];
            }
            throw Error(`Unknown player <${identifier}> ??`);
        },

        // Sends a message to damage a player
        damagePlayer(player, damageAmount, unknownValue = 0) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x3])); // Action marker (damage)
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x5])); // Unknown marker
            // These seem to be position/velocity data
            stream.writeBytes(
                new Uint8Array([
                    0x53, 0x1, 0x56, 0xc, 0xc2, 0x9f, 0x3e, 0xc6, 0x40, 0xa0, 0xeb, 0x4b,
                    0xc2, 0x4, 0x83, 0x65,
                ])
            );
            stream.writeBytes(
                new Uint8Array([
                    0x53, 0x1, 0x56, 0xc, 0xc2, 0x9f, 0x3e, 0xc6, 0x40, 0xa0, 0xeb, 0x4b,
                    0xc2, 0x4, 0x83, 0x65,
                ])
            );
            stream.writeTypedNumber(player.tag);
            stream.writeTypedNumber(damageAmount);
            stream.writeTypedNumber(unknownValue);
            this.sendGameMessage(stream.data, "damagePlayer");
        },

        // Sends a message to kill a player
        killPlayer(player) {
            const contentMap = new TypedKeyMap();
            contentMap.set(new TypedValue(0x22, null), this.localPlayer.tag); // Player tag
            contentMap.set(new TypedValue(0x3, 0x2), GAME_CONSTANTS.MAGIC_NUMBER_2); // Magic number
            contentMap.set(new TypedValue(0x3, 0x5), new TypedValue(0x3, 0x4)); // Action: Kill (0x4)
            const targetArray = [player.tag];
            targetArray.type = 0x17; // Any array type
            contentMap.set(new TypedValue(0x3, 0x4), targetArray); // Target player tag

            const killMessage = new KeyMap(
                "killPlayer",
                CLIENT_MESSAGE_SIGNATURES.PLAYER_KILL
            );
            killMessage.set(MESSAGE_FIELD_IDS.content, contentMap);

            const stream = new CustomDataStream();
            stream.writeKeyMap(killMessage);
            this.sendGameMessage(stream.data, "killPlayer");
        },

        // Teleports a player to a specific position (or resets them)
        teleportPlayer(player, resetPosition = false) {
            // Helper to convert UInt32 to Float32
            function uint32ToFloat32(uint) {
                const buffer = new ArrayBuffer(4);
                new DataView(buffer).setUint32(0, uint, true);
                return new Float32Array(buffer)[0];
            }

            let coords;
            if (resetPosition) {
                // Teleport to a "safe" but far away location (e.g., for ban)
                const farAway = uint32ToFloat32(0xff7fffff); // Max float value
                coords = [farAway, farAway, farAway];
            } else {
                // Teleport to a "default" or "invalid" location (e.g., for invisibility punish)
                const invalid = uint32ToFloat32(0xeeeeeeee); // Specific invalid float value
                coords = [invalid, invalid, invalid];
            }

            this.movePlayerTo(player, coords);
        },

        // Sends a message to move a player to specific coordinates
        movePlayerTo(player, coordinates) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc9])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x17, 0x3])); // Content marker
            stream.writeTypedNumber(0xcafe); // Magic number
            stream.writeBytes(new Uint8Array([0x8, 0x17, 0x7])); // Unknown marker
            stream.writeTypedNumber(player.tag);
            stream.writeBytes(new Uint8Array([0x1b])); // Unknown marker
            stream.writeBytes(new Uint8Array([0x8])); // Unknown marker
            stream.writeTypedNumber(0x0); // Unknown value
            stream.writePoint3Array(coordinates); // Position
            stream.writePoint3Array(coordinates); // Velocity (same as position)
            const rotationY = 1; // Fixed rotation Y
            stream.writePoint4Array([rotationY, 0x0, 0x1, 0x0]); // Rotation (Quaternion-like)
            this.sendGameMessage(stream.data, "MovePlayerTo");
            player.unknownValue = 0; // Reset unknown value
            player.lastActionTime = Date.now() + 10000; // Set grace period for teleported player
        },

        // Sends a chat message to the game
        sendChatMessage(message) {
            // Split message into chunks if too long (max 200 chars)
            const messageChunks = (() => {
                if (!message) return [];
                const parts = message.match(/<[^>]+>\s*|[^<\s][^\s<]*\s*|\s+/g) || []; // Split by tags, words, spaces
                const chunks = [];
                let currentChunk = decodeXORString([], 0xeb); // Empty string
                for (let part of parts) {
                    // Censor profanity if operator level is low
                    if (this.operatorLevel < 2) {
                        const censoredWords = [
                            "fuck",
                            "shit",
                            "dick",
                            "cock",
                            "penis",
                            "pussy",
                            "cunt",
                            "nig",
                            "nigg",
                            "nigga",
                            "nigger",
                            "faggot",
                            "retard",
                            "retarded",
                            "sex",
                            "bitch",
                            "ass",
                            "porn",
                            "fag",
                            "rape",
                            "slave",
                        ];
                        const cleanedPart = part
                            .toLowerCase()
                            .replace(/[?!.,;:()\[\]{}'"-_ ]/g, decodeXORString([], 0xea)); // Remove punctuation
                        if (censoredWords.includes(cleanedPart)) {
                            part = part[0] + "<i>" + part.slice(1); // Obfuscate censored word
                        }
                    }
                    // Chunk message if it exceeds 200 characters
                    if (
                        currentChunk.length + (currentChunk ? 1 : 0) + part.length >
                        200
                    ) {
                        if (currentChunk) {
                            chunks.push(currentChunk);
                        }
                        currentChunk = part;
                    } else {
                        currentChunk += part;
                    }
                }
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                return chunks;
            })();

            for (const chunk of messageChunks) {
                const stream = new CustomDataStream();
                stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.CHAT_MESSAGE);
                stream.writeBytes(new Uint8Array([0xf5, 0x17, 0x1])); // Content marker
                stream.writeTypedString(chunk);
                this.sendGameMessage(stream.data, "sayChat");
            }
        },

        // Speaks a message using browser's SpeechSynthesis API
        speakMessage(message) {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = "en-US";
            speechSynthesis.speak(utterance);
        },

        // Sends a message to set the player's nickname
        setNickname(name) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.SET_NICKNAME);
            stream.writeBytes(new Uint8Array([0xfb, 0x15, 0x1, 0x3, 0xff])); // Content marker
            stream.writeTypedString(name);
            stream.writeId(this.localPlayer.id);
            stream.writeByte(0xfa); // Unknown marker
            stream.writeByte(0x1c); // Unknown marker
            this.sendGameMessage(stream.data, "setNick");
            sendUnityMessage("MapScripts", "SetNickname", name); // Update Unity UI
        },

        // Sends a message to change the player's class
        changeClass(classId) {
            if (typeof classId !== "number") {
                classId = CLASSES.getId(classId);
            }
            sendUnityMessage("MapScripts", "ChangeClassTo", classId); // Update Unity UI
        },

        // Sends a message to set the player's in-game skin and hat
        setInGameSkin(skinIndex, hatIndex = -1) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8, 0xf5, 0x15, 0x4])); // Unknown marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(
                new Uint8Array([0x3, 0x5, 0x3, 0x8, 0x3, 0x4, 0x17, 0x3, 0xb, 0x6])
            ); // Action marker (set skin)
            stream.writeTypedNumber(skinIndex);
            stream.writeTypedNumber(hatIndex);
            this.sendGameMessage(stream.data, "setSkin");
        },

        // Sends a message to set the player's lobby skin and hat
        setLobbySkin(skinIndex, hatIndex = -1) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.SET_LOBBY_SKIN);
            stream.writeBytes(new Uint8Array([0xfb, 0x15, 0x2])); // Content marker
            stream.writeTypedString("characterSkinIndex");
            stream.writeTypedNumber(skinIndex);
            stream.writeTypedString("hatIndex");
            stream.writeTypedNumber(hatIndex);
            stream.writeId(this.localPlayer.id);
            stream.writeBytes(new Uint8Array([0xfa, 0x1c])); // Unknown marker
            this.sendGameMessage(stream.data, "setLobbySkin");
        },

        // Sends a message to heal the player
        healPlayer(player) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x3])); // Action marker (heal)
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x1])); // Unknown marker
            stream.writeTypedNumber(player); // Player ID to heal
            this.sendGameMessage(stream.data, "heal");
        },

        // Cycles to the next fast class
        cycleFastClass() {
            const classes = TOOL_CONFIG.fastClasses;
            if (!classes || classes.length < 1) {
                return;
            }
            let currentIndex = classes.indexOf(this.currentClassId);
            if (!(++currentIndex < classes.length)) {
                currentIndex = 0; // Loop back to start
            }
            const nextClass = classes[currentIndex];
            this.changeClass(nextClass);
            this.currentClassId = nextClass;
        },

        // Starts skin/hat cycling
        startSkinHatCycle(skinIndices, hatIndices, intervalMs = 100) {
            let cycleCounter = 0;
            this.stopSkinHatCycle(); // Stop any existing cycle
            this.skinCycleIntervalId = setInterval(() => {
                const currentSkin =
                    skinIndices[cycleCounter % skinIndices.length] ?? -1;
                const currentHat = hatIndices[cycleCounter % hatIndices.length] ?? -1;
                if (this.isMapPlaying) {
                    this.setInGameSkin(currentSkin, currentHat);
                }
                cycleCounter++;
            }, intervalMs);
        },

        // Stops skin/hat cycling
        stopSkinHatCycle() {
            if (this.skinCycleIntervalId !== 0) {
                clearInterval(this.skinCycleIntervalId);
                this.skinCycleIntervalId = 0;
            }
            if (this.isMapPlaying) {
                this.setInGameSkin(
                    this.localPlayer.skinIndex,
                    this.localPlayer.hatIndex
                ); // Revert to original skin/hat
            }
        },

        // Starts a dance with optional skin/hat cycling
        startDanceWithEffects(danceName, skinIndices = [], hatIndices = []) {
            if (this.danceTimerId !== 0) {
                clearTimeout(this.danceTimerId);
                this.danceTimerId = 0;
            }
            this.stopSkinHatCycle(); // Stop any existing skin cycle

            if (this.isMapPlaying) {
                this.startDance(danceName);
            } else {
                this.lobbyDance(danceName);
            }

            if (skinIndices.length > 0 || hatIndices.length > 0) {
                this.startSkinHatCycle(skinIndices, hatIndices);
            }

            const danceDuration = DANCES.getDuration(danceName);
            this.danceTimerId = setTimeout(() => {
                clearTimeout(this.danceTimerId);
                this.danceTimerId = 0;
                this.stopDance();
                this.stopSkinHatCycle();
            }, danceDuration);
        },

        // Resets player list and clears other player data
        resetPlayerListAndData() {
            this.localPlayer.id = 0;
            this.otherPlayers.clear();
            this.updatePlayerListUI();
        },

        // Punishes all detected cheaters
        punishAllCheaters() {
            const cheaters = Array.from(this.otherPlayers.values()).filter(
                (p) => p.isCheater > 1
            );
            if (cheaters.length !== 0) {
                for (const player of cheaters) {
                    this.punishPlayer(player);
                }
            } else {
                this.showMessage("No more players to punish.");
            }
        },

        // Applies punishment to a player based on detected cheats
        punishPlayer(player) {
            if (player.isCheater <= 1) {
                // If player is protected or not a cheater
                return;
            }

            let reason = "his sins";
            if (player.isInvisible) {
                reason = "invisibility";
            } else if (player.isInstakilling) {
                reason = "instakilling";
            } else if (player.isMoonSniping) {
                reason = "moon sniping";
            } else if (player.isBootlegTools) {
                reason = "outdated tools";
            }

            this.showMessage(`<color=red>Punishing ${player.displayName}`);
            const punishmentMessage = `<color=#e70aff>${player.rawName}</color><color=green> was <color=red>punished</color> for ${reason}.`;
            this.sendChatMessage(punishmentMessage);

            if (player.isBootlegTools) {
                // If bootleg tools, teleport them to a "banned" location after a delay
                setTimeout(() => {
                    this.teleportPlayer(player, true); // Teleport to far away
                }, 750); // 0x2EE
            } else {
                console.log("killing");
                this.damagePlayer(player, 250, 1); // Deal damage
                this.killPlayer(player); // Kill player
                if (player.isInvisible) {
                    console.log("teleporting");
                    this.teleportPlayer(player, false); // Teleport to invalid location
                }
            }
        },

        // "Nukes" all clients (teleports them to infinity)
        nukeAllClients() {
            this.showMessage("<color=orange>Nuking all clients, please wait.");
            this.setInGameSkin(this.localPlayer.skinIndex, 0x50); // Change local player's hat
            this.setInGameSkin(this.localPlayer.skinIndex, this.localPlayer.hatIndex); // Revert hat
            for (const player of this.otherPlayers.values()) {
                this.movePlayerTo(player, [Infinity, Infinity, Infinity]); // Teleport to infinity
            }
        },

        // Sends all players to the sky
        sendAllPlayersToSky() {
            for (const player of this.otherPlayers.values()) {
                console.log(player);
                const randomX = Math.random() * 10 + -5;
                const randomY = Math.random() * 2 + 400; // 0x190
                const randomZ = Math.random() * 10 + -5;
                this.movePlayerTo(player, [randomX, randomY, randomZ]);
            }
            this.showMessage(
                `<color=green>Thank you for flying with</color> <color=#F0F>${this.localPlayer.displayName} Air!</color>`
            );
        },

        // --- UI and Event Handling ---

        // Handles keyboard events for tool hotkeys
        handleKeyboardEvent(event) {
            // Ignore events from input fields
            if (event.target.matches("input, textarea")) {
                return false;
            }

            // Open/close menu hotkey
            if (event.code === TOOL_CONFIG.openMenuKey) {
                this.toggleMenu();
                document.exitPointerLock(); // Exit pointer lock (Unity game)
                return true;
            }

            // Chat hotkey
            if (event.code === TOOL_CONFIG.chatKey) {
                if (this.isMapPlaying && this.isGameWebSocketActive) {
                    this.toggleChatInput();
                    return true;
                }
            } else {
                // Fast class hotkey
                if (event.code === TOOL_CONFIG.fastClassKey) {
                    this.cycleFastClass();
                } else {
                    // Skin emote hotkeys
                    const skinEmote = TOOL_CONFIG.skinEmotes.find(
                        (emote) => emote.keyBinding === event.code
                    );
                    if (skinEmote) {
                        this.startDanceWithEffects(
                            skinEmote.danceName,
                            skinEmote.skinIndices,
                            skinEmote.hatIndices
                        );
                        this.showMessage(
                            `<color=yellow>${skinEmote.name && skinEmote.name.trim() !== ""
                                ? skinEmote.name
                                : skinEmote.danceName
                            }`
                        );
                    }
                }
            }
            return false;
        },

        // Shows the main menu temporarily (with a timeout)
        showMenuTemporarily(forceShow = false, duration = 250) {
            if (!(this.menuDisplayTimeoutId || (!forceShow && false))) {
                // Original logic
                this.menuDisplayTimeoutId = setTimeout(() => {
                    clearTimeout(this.menuDisplayTimeoutId);
                    this.menuDisplayTimeoutId = 0;
                    this.renderMainMenu(); // Render the main menu
                }, duration);
            }
        },

        // Creates a semi-transparent overlay for popups
        createOverlay(id) {
            const overlay = document.createElement("div");
            overlay.id = `${id}-overlay`;
            overlay.classList.add("overlay");
            overlay.onclick = () => this.closePopup(id);
            overlay.oncontextmenu = (e) => {
                e.preventDefault();
                this.closePopup(id);
            };
            document.body.appendChild(overlay);
        },

        // Creates a generic popup window
        createPopup(id, icon, title, showOverlay = true) {
            const popup = document.createElement("div");
            popup.id = id;
            popup.classList.add("hax-popup");

            const titlebar = (() => {
                const div = document.createElement("div");
                div.classList.add("titlebar");
                const iconSpan = document.createElement("span");
                iconSpan.classList.add("title-icon");
                iconSpan.textContent = icon;
                div.appendChild(iconSpan);
                const titleH3 = document.createElement("h3");
                titleH3.textContent = title;
                titleH3.classList.add("title-text");
                div.appendChild(titleH3);
                const closeButton = document.createElement("button");
                closeButton.textContent = "✖";
                closeButton.classList.add("title-close-button");
                closeButton.title = "Close";
                closeButton.addEventListener("click", () => this.closePopup(id));
                div.appendChild(closeButton);
                return div;
            })();

            popup.appendChild(titlebar);
            if (showOverlay) {
                this.createOverlay(id);
            }
            return popup;
        },

        // Closes a popup window and its overlay
        closePopup(id) {
            const popup = document.getElementById(id);
            if (popup) {
                popup.remove();
            }
            const overlay = document.getElementById(`${id}-overlay`);
            if (overlay) {
                overlay.remove();
            }
        },

        // Creates an HTML table row for a player in the player list
        createPlayerTableRow(player) {
            const createCell = (row, content) => {
                const cell = document.createElement("td");
                if (typeof content === "string") {
                    cell.textContent = content;
                } else {
                    cell.appendChild(content);
                }
                row.appendChild(cell);
                return cell;
            };

            const row = document.createElement("tr");
            row.id = player.htmlId;
            row.classList.add("player-row");

            createCell(
                row,
                player === this.playerWhoKilledMe ? "💀" : decodeXORString([], 0xdc)
            ); // Decodes to ''
            createCell(row, player.bounty > 0 ? "💥" : decodeXORString([], 0xbe)); // Decodes to ''

            const playerButton = document.createElement("button");
            playerButton.classList.add("player-button");

            const stateIcon = document.createElement("span");
            stateIcon.classList.add("state");
            if (player.isCheater === 1) {
                // Protected
                stateIcon.textContent = "🛡️";
                playerButton.classList.add("protected");
                playerButton.title = "Protected. Click to reset.";
            } else if (player.isCheater === 2) {
                // Naughty
                stateIcon.textContent = "😈";
                playerButton.classList.add("naughty");
                playerButton.title = "Naughty. Click to reset.";
            } else if (player.isCheater === 3) {
                // Cheater
                stateIcon.textContent = "⚠️";
                playerButton.classList.add("cheater");
                playerButton.title = "Cheater. Click to disable.";
            } else if (player.isCheater === 0) {
                // Normal
                if (this.operatorLevel >= 3 || player.totalCheatDetections > 0) {
                    playerButton.title = "Click to punish.";
                } else {
                    playerButton.title =
                        "License required to punish without detected cheats.";
                }
            }
            playerButton.appendChild(stateIcon);

            const nameSpan = document.createElement("span");
            nameSpan.classList.add("name");
            nameSpan.textContent = player.displayName;
            if (player.lastDeathTime) {
                nameSpan.classList.add("dead"); // Strikethrough if dead
            }
            if (player.toolVersion && player.toolVersion !== "") {
                nameSpan.classList.add("tools"); // Add gear icon if using tools
            }
            playerButton.appendChild(nameSpan);

            const cheatsSpan = document.createElement("span");
            cheatsSpan.classList.add("cheats");
            cheatsSpan.textContent += player.isInvisible
                ? "👻 "
                : decodeXORString([], 0x29); // Decodes to ''
            cheatsSpan.textContent += player.isInstakilling
                ? "⚔️ "
                : decodeXORString([], 0x43); // Decodes to ''
            cheatsSpan.textContent += player.isMoonSniping
                ? "🌕 "
                : decodeXORString([], 0x92); // Decodes to ''
            cheatsSpan.textContent += player.isBootlegTools
                ? "📚 "
                : decodeXORString([], 0x5f); // Decodes to ''
            if (!player.hasActiveCheats && player.totalCheatDetections > 0) {
                cheatsSpan.textContent += "👀 "; // Eye icon if detections but no active cheats
            }
            playerButton.appendChild(cheatsSpan);

            playerButton.addEventListener("click", () =>
                this.togglePlayerPunishmentState(player)
            );
            playerButton.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                this.showPlayerContextMenu(e, player);
            });
            createCell(row, playerButton);
            return row;
        },

        // Toggles a player's punishment state
        togglePlayerPunishmentState(player) {
            // Only allow if operator level is sufficient or cheats are detected
            if (!(this.operatorLevel < 3)) {
                // Apply tamper check
                if (validateTamper(this.operatorLevel, TAMPER_VALUE_1)) {
                    if (player.isCheater === 0) {
                        // Normal -> Naughty (if detections)
                        if (!(this.operatorLevel < 3 && player.totalCheatDetections <= 0)) {
                            player.isCheater = 2;
                        }
                    } else if (player.isCheater === 1 || player.isCheater === 2) {
                        // Protected/Naughty -> Normal
                        player.isCheater = 0;
                        player.resetCheatFlags();
                    } else if (player.isCheater === 3) {
                        // Cheater -> Protected
                        player.isCheater = 1;
                    }
                    if (player.isCheater > 1) {
                        // If marked as Naughty or Cheater
                        this.punishPlayer(player);
                    }
                    this.updatePlayerUI(player); // Update player UI
                }
            }
        },

        // Creates a menu item for context menus
        createContextMenuItem(menuId, icon, text, callback) {
            const item = document.createElement("li");
            item.classList.add("menu-item");
            item.textContent = text;
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                this.closePopup(menuId);
                callback();
            });
            item.innerHTML = `${icon} ${text}`;
            return item;
        },

        // Grants/revokes license for a player (admin function)
        async grantLicense(player, level, isAdmin = false, days = 7) {
            const licenseKey = await this.generateLicenseKey(
                player.uid,
                level,
                isAdmin ? level - 1 : 0,
                days
            );
            this.sendCustomCommand(CUSTOM_COMMAND_PROTOCOL.SET_KEY, player, [
                licenseKey,
            ]);
        },

        // Shows a context menu for a player
        showPlayerContextMenu(event, player) {
            const menuId = "hax-player-menu";
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
            }

            menu = document.createElement("div");
            menu.id = menuId;
            menu.classList.add("hax-popup");
            menu.style.left = `${event.clientX}px`;
            menu.style.top = `${event.clientY}px`;

            const menuList = document.createElement("ul");
            menuList.classList.add("menu-list");
            menu.appendChild(menuList);

            // View profile option
            const viewProfileItem = this.createContextMenuItem(
                menuId,
                "🧑‍💻",
                "View profile",
                () => this.showUserProfile(player)
            );
            if (!(player.uid && player.uid !== "")) {
                viewProfileItem.classList.add("disabled"); // Disable if no UID
            }
            menuList.appendChild(viewProfileItem);

            // Check tools option (if player has tool version info)
            if (
                player.toolVersion &&
                player.toolVersion !== "" &&
                player.operatorLevel !== null
            ) {
                const checkToolsItem = this.createContextMenuItem(
                    menuId,
                    "⚙️",
                    player.toolVersion,
                    () =>
                        this.sendCustomCommand(
                            CUSTOM_COMMAND_PROTOCOL.GET_VERSION,
                            player,
                            [player.id]
                        )
                );
                menuList.appendChild(checkToolsItem);

                // License admin options (if current user has higher operator level)
                if (
                    player.operatorLevel < this.currentOperatorLevel &&
                    validateTamper(this.currentOperatorLevel, TAMPER_VALUE_2)
                ) {
                    const separator = document.createElement("hr");
                    menuList.appendChild(separator);
                    const manageLicenseItem = this.createContextMenuItem(
                        menuId,
                        OPERATOR_ICONS[player.operatorLevel],
                        `${OPERATOR_LEVELS[player.operatorLevel]} (${player.operatorLevel
                        })`,
                        () => this.showLicenseAdminMenu(player)
                    );
                    menuList.appendChild(manageLicenseItem);

                    // Ban player option (for high operator levels)
                    if (this.currentOperatorLevel >= 5) {
                        const banSeparator = document.createElement("hr");
                        menuList.appendChild(banSeparator);
                        const banPlayerItem = this.createContextMenuItem(
                            menuId,
                            "🚫",
                            "Ban player (tools)",
                            async () => {
                                const banReason = "Shitty behavior";
                                const banKey = await this.generateLicenseKey(
                                    player.uid,
                                    0,
                                    0,
                                    1000
                                ); // Ban for 1000 days
                                this.sendCustomCommand(
                                    CUSTOM_COMMAND_PROTOCOL.BAN_PLAYER,
                                    player,
                                    [banKey, banReason]
                                );
                            }
                        );
                        menuList.appendChild(banPlayerItem);
                    }
                }
            } else {
                // Option to check tools if no info available
                const checkToolsItem = this.createContextMenuItem(
                    menuId,
                    "ℹ️",
                    "Check tools",
                    () =>
                        this.sendCustomCommand(
                            CUSTOM_COMMAND_PROTOCOL.GET_VERSION,
                            player,
                            [player.id]
                        )
                );
                menuList.appendChild(checkToolsItem);
            }

            this.createOverlay(menuId);
            document.body.appendChild(menu);
        },

        // Updates a single player's row in the UI
        updatePlayerUI(player, delay = 100) {
            const playerElement = document.getElementById(player.htmlId);
            if (!playerElement) {
                return;
            }
            const newPlayerElement = this.createPlayerTableRow(player);
            playerElement.replaceWith(newPlayerElement);
        },

        // Renders/updates the entire player list UI
        updatePlayerListUI(delay = 100) {
            const playerTableId = "hax-players";
            const playerTable = document.getElementById(playerTableId);
            if (!playerTable) {
                return;
            }

            // Remove existing player rows
            const existingRows = playerTable.querySelectorAll("tr.player-row");
            for (const row of existingRows) {
                row.remove();
            }

            // Sort players alphabetically by display name
            const sortedPlayers = [...this.otherPlayers.values()].sort((a, b) =>
                a.displayName.localeCompare(b.displayName)
            );

            // Add/update player rows
            for (const player of sortedPlayers) {
                const existingPlayerElement = document.getElementById(player.htmlId);
                const newPlayerElement = this.createPlayerTableRow(player);
                if (existingPlayerElement) {
                    existingPlayerElement.replaceWith(newPlayerElement);
                } else {
                    playerTable.appendChild(newPlayerElement);
                }
            }

            // Display message if no other players
            if (sortedPlayers.length < 1) {
                const noPlayersRow = document.createElement("tr");
                noPlayersRow.id = "nobody";
                noPlayersRow.classList.add("player-row");
                let message = decodeXORString([], 0xb5); // Decodes to ''
                message = this.isLoggedIn
                    ? `Shield's up, ${this.currentUser.displayName}!`
                    : "Not signed in.";
                if (this.isMapPlaying) {
                    if (this.isGameWebSocketActive) {
                        message += "<br>(No other players)";
                    } else {
                        message += "<br>⛔ Match not initialized.";
                    }
                } else {
                    message += `<br>${this.operatorLevel} : ${OPERATOR_ICONS[this.operatorLevel]
                        } ${OPERATOR_LEVELS[this.operatorLevel]}`;
                }
                noPlayersRow.innerHTML = `<td colspan='99'><h5>${message}</h5></td>`;
                playerTable.appendChild(noPlayersRow);
            }
        },

        // Creates an icon button
        createIconButton(icon, title, callback) {
            const button = document.createElement("button");
            button.classList.add("icon-button");
            button.title = title;
            button.innerHTML = icon;
            button.addEventListener("click", (e) => {
                e.stopPropagation();
                callback();
            });
            return button;
        },

        // Creates a dialog button
        createDialogButton(text, className, callback) {
            const button = document.createElement("button");
            button.classList.add("dialog-button");
            button.classList.add(className);
            button.title = text;
            button.innerHTML = text;
            button.addEventListener("click", (e) => {
                e.stopPropagation();
                callback();
            });
            return button;
        },

        // Renders the main Kaleido Tools menu
        renderMainMenu() {
            const menuId = "hax-menu";
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
            }

            menu = this.createPopup(menuId, "🛠️", TOOL_VERSION, false); // No overlay for main menu
            document.body.appendChild(menu);

            const playersWrapper = document.createElement("div");
            playersWrapper.id = "hax-players-wrapper";
            menu.appendChild(playersWrapper);

            const playerTable = document.createElement("table");
            playerTable.id = "hax-players";
            playerTable.innerHTML =
                '<thead><tr><th class="icon-col"></th><th class="icon-col"></th><th class="name"></th></tr></thead>';
            playersWrapper.appendChild(playerTable);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("buttons");

            const settingsButton = this.createIconButton("⚙️", "Settings", () =>
                this.renderSettingsMenu()
            );
            buttonsDiv.appendChild(settingsButton);

            if (this.operatorLevel > 0) {
                const changePasswordButton = this.createIconButton(
                    "🔑",
                    "Change password",
                    () => this.renderPasswordChangeMenu()
                );
                buttonsDiv.appendChild(changePasswordButton);
            }

            if (this.operatorLevel >= 4) {
                const clanRapeButton = this.createIconButton("🏰", "Clan rape", () =>
                    this.renderClanRapeMenu()
                );
                clanRapeButton.disabled = this.isMapPlaying; // Disable if in game
                buttonsDiv.appendChild(clanRapeButton);
            }

            if (this.operatorLevel >= 4) {
                const nukeButton = this.createIconButton("☢️", "Nuke everyone", () =>
                    this.nukeAllClients()
                );
                nukeButton.disabled = !this.isMapPlaying; // Disable if not in game
                buttonsDiv.appendChild(nukeButton);
            }

            if (this.operatorLevel >= 4) {
                const skyButton = this.createIconButton(
                    "🚀",
                    "Send everyone to the sky",
                    () => this.sendAllPlayersToSky()
                );
                skyButton.disabled = !this.isMapPlaying; // Disable if not in game
                buttonsDiv.appendChild(skyButton);
            }

            menu.appendChild(buttonsDiv);
            this.updatePlayerListUI(); // Populate player list
        },

        // --- Settings UI Elements ---

        // Creates a generic input field label and wrapper
        createInputField(requiredLevel, name, placeholder, title, currentValue) {
            const label = document.createElement("label");
            label.classList.add("label");

            const labelText = document.createElement("span");
            labelText.classList.add("label-text");
            if (requiredLevel) {
                name = `${OPERATOR_ICONS[requiredLevel]} ${name}`; // Add level icon
                label.title = `Requires ${OPERATOR_LEVELS[requiredLevel]} (${requiredLevel})`;
            }
            labelText.textContent = `${name}: `;
            label.appendChild(labelText);

            const inputWrapper = document.createElement("div");
            inputWrapper.classList.add("input-wrapper");
            label.appendChild(inputWrapper);

            const input = document.createElement("input");
            input.classList.add("input-field");
            input.placeholder = placeholder;
            input.title = title;
            input.value = currentValue;
            input.autocomplete = "off";
            input.autocorrect = "off";
            input.autocapitalize = "none";
            input.spellcheck = false;
            input.disabled = requiredLevel > this.operatorLevel; // Disable if level too low
            inputWrapper.appendChild(input);

            const clearButton = document.createElement("button");
            clearButton.classList.add("clear-button");
            clearButton.title = "Clear";
            clearButton.innerHTML = "✖";
            clearButton.tabIndex = -1; // Not focusable
            clearButton.style.display = currentValue ? "block" : "none"; // Show if value exists
            clearButton.addEventListener("click", (e) => {
                e.stopPropagation();
                input.value = null;
                if (input.type === "checkbox") {
                    input.checked = false;
                } else if (input.type === "range") {
                    input.value = 0;
                }
                input.dispatchEvent(new Event("input")); // Trigger input event
                input.dispatchEvent(new Event("change")); // Trigger change event
            });
            inputWrapper.appendChild(clearButton);

            input.addEventListener("input", (e) => {
                e.stopPropagation();
                if (input.value === "") {
                    input.value = null;
                }
                let hasValue = input.value !== null && input.value !== "";
                if (input.type === "checkbox") {
                    hasValue = input.checked;
                } else if (input.type === "range") {
                    hasValue = parseInt(input.value) > 0;
                }
                clearButton.style.display = hasValue ? "block" : "none";
                input.dispatchEvent(new Event("change")); // Trigger change event
            });

            if (requiredLevel > this.operatorLevel) {
                label.style.display = "none"; // Hide if level too low
            }
            return label;
        },

        // Creates a text input field
        createTextInput(requiredLevel, name, placeholder, title, currentValue) {
            const field = this.createInputField(
                requiredLevel,
                name,
                placeholder,
                title,
                currentValue
            );
            field.classList.add("text-clear");
            const input = field.querySelector("input");
            input.classList.add("text-field");
            input.type = "text";
            return field;
        },

        // Creates a password input field
        createPasswordField(requiredLevel, name, placeholder, title, currentValue) {
            const field = this.createInputField(
                requiredLevel,
                name,
                placeholder,
                title,
                currentValue
            );
            field.classList.add("text-clear");
            const input = field.querySelector("input");
            input.classList.add("password-field");
            input.type = "password";
            return field;
        },

        // Creates a number input field
        createNumberInput(
            requiredLevel,
            name,
            placeholder,
            min,
            max,
            currentValue
        ) {
            const field = this.createInputField(
                requiredLevel,
                name,
                decodeXORString([], 0x40),
                placeholder,
                currentValue
            ); // Placeholder is empty string
            const input = field.querySelector("input");
            input.classList.add("number-field");
            input.type = "number";
            input.placeholder = `${min} - ${max}`;
            input.min = min;
            input.max = max;
            input.step = 1;
            return field;
        },

        // Creates a range (slider) input field
        createRangeInput(
            requiredLevel,
            name,
            placeholder,
            min,
            max,
            optionsArray,
            currentValue
        ) {
            const field = this.createNumberInput(
                requiredLevel,
                name,
                placeholder,
                min,
                max,
                currentValue
            );
            field.classList.add("no-clear"); // No clear button for range
            const input = field.querySelector("input");
            input.classList.add("slider-field");
            input.type = "range";

            const valueText = document.createElement("span");
            valueText.classList.add("slider-value-text");
            if (currentValue < 0 || currentValue > optionsArray.length) {
                valueText.textContent = currentValue;
            } else {
                valueText.textContent = optionsArray[currentValue];
            }
            input.addEventListener("input", () => {
                if (input.value === null || input.value === "") {
                    input.value = 0;
                }
                if (
                    parseInt(input.value) < 0 ||
                    parseInt(input.value) > optionsArray.length
                ) {
                    valueText.textContent = input.value;
                } else {
                    valueText.textContent = optionsArray[parseInt(input.value)];
                }
            });
            input.insertAdjacentElement("afterend", valueText); // Insert after input
            return field;
        },

        // Creates a checkbox input field
        createCheckboxInput(requiredLevel, name, title, currentValue) {
            const field = this.createInputField(
                requiredLevel,
                name,
                decodeXORString([], 0x9b),
                title,
                currentValue
            ); // Placeholder is empty string
            field.classList.add("no-clear");
            const input = field.querySelector("input");
            input.classList.add("checkbox-field");
            input.type = "checkbox";
            input.checked = currentValue;
            input.addEventListener("change", () => {
                input.value = input.checked ? "true" : "false";
            });
            input.value = currentValue ? "true" : "false";
            return field;
        },

        // Creates a select (dropdown) input field
        createSelectInput(requiredLevel, name, title, options, currentValue) {
            const field = this.createInputField(
                requiredLevel,
                name,
                decodeXORString([], 0x8e),
                title,
                currentValue
            ); // Placeholder is empty string
            field.classList.add("select-field");
            field.classList.add("no-clear");

            const hiddenInput = field.querySelector("input");
            hiddenInput.classList.add("select-input");
            hiddenInput.type = "text";
            hiddenInput.readOnly = true; // Make it read-only

            const inputWrapper = field.querySelector(".input-wrapper");
            const select = document.createElement("select");
            select.classList.add("input-field");
            select.classList.add("select-options");

            for (const option of options) {
                const optElement = document.createElement("option");
                optElement.value = option.value;
                optElement.textContent = option.label;
                if (option.value == currentValue) {
                    // Use == for type coercion
                    optElement.selected = true;
                }
                select.appendChild(optElement);
            }

            select.addEventListener("change", () => {
                hiddenInput.value = select.options[select.selectedIndex].value;
                hiddenInput.dispatchEvent(new Event("change")); // Trigger change on hidden input
            });
            inputWrapper.appendChild(select);
            return field;
        },

        // Gets the value from a settings input field
        getFieldValue(fieldElement) {
            if (fieldElement === null) {
                return null;
            }
            const input =
                fieldElement instanceof HTMLInputElement
                    ? fieldElement
                    : fieldElement.querySelector("input");
            if (input) {
                if (input.type === "number" || input.type === "range") {
                    return parseInt(input.value);
                } else if (input.type === "checkbox") {
                    return input.checked;
                } else if (input.type === "text" || input.type === "password") {
                    return input.value?.trim();
                }
                return input.value; // Default for other types
            }
            throw Error("Field has no input element.");
        },

        // Creates a skin emote configuration section for the settings menu
        createSkinEmoteSection(requiredLevel, emoteData) {
            const section = document.createElement("div");
            section.classList.add("skin-emote");

            section.appendChild(
                this.createTextInput(
                    requiredLevel,
                    "Name",
                    "E.g. 'Rainbow Chicken'",
                    "The name of the emote.",
                    emoteData.name
                )
            );
            section.appendChild(
                this.createTextInput(
                    requiredLevel,
                    "Key",
                    "E.g. KeyC",
                    "Click to set a key for this emote.",
                    emoteData.keyBinding
                )
            );
            section.appendChild(
                this.createSelectInput(
                    requiredLevel,
                    "Dance",
                    "The dance to perform with this emote.",
                    DANCES.getDanceListForUI(),
                    emoteData.danceName
                )
            );

            const skinsString = emoteData.skinIndices.join(", ");
            section.appendChild(
                this.createTextInput(
                    requiredLevel,
                    "Skins",
                    "E.g. 25, 26, 49, 65, 67, 70",
                    "A comma separated list of skins to use with this emote.",
                    skinsString
                )
            );

            const hatsString = emoteData.hatIndices.join(", ");
            section.appendChild(
                this.createTextInput(
                    requiredLevel,
                    "Hats",
                    "E.g. 1, 2, 3",
                    "A comma separated list of hats to use with this emote.",
                    hatsString
                )
            );

            const intervalField = this.createRangeInput(
                requiredLevel,
                "Interval",
                "The interval in milliseconds between outfit changes.",
                100,
                1000,
                [],
                emoteData.intervalMs
            );
            intervalField.classList.add("no-clear");
            intervalField.querySelector("input").step = 50; // Step by 50ms
            section.appendChild(intervalField);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("emote-buttons");
            section.appendChild(buttonsDiv);

            const deleteButton = this.createDialogButton(
                "🗑️ Delete",
                "delete",
                () => {
                    section.remove(); // Remove the section from UI
                }
            );
            buttonsDiv.appendChild(deleteButton);

            return section;
        },

        // Extracts SkinEmote data from a UI section
        getSkinEmoteDataFromSection(sectionElement) {
            const labels = sectionElement.querySelectorAll("label");
            const name = this.getFieldValue(labels[0]);
            const keyBinding = this.getFieldValue(labels[1]);
            const danceName = this.getFieldValue(labels[2]);
            const skinsRaw = this.getFieldValue(labels[3]);
            const hatsRaw = this.getFieldValue(labels[4]);
            const interval = parseInt(this.getFieldValue(labels[5]));

            const skins =
                skinsRaw
                    ?.split(/[\s,]+/)
                    ?.map((s) => parseInt(s.trim()))
                    ?.filter((n) => !isNaN(n)) || [];
            const hats =
                hatsRaw
                    ?.split(/[\s,]+/)
                    ?.map((s) => parseInt(s.trim()))
                    ?.filter((n) => !isNaN(n)) || [];

            const emote = new SkinEmote();
            emote.name = name;
            emote.keyBinding = keyBinding;
            emote.danceName = danceName;
            emote.skinIndices = skins;
            emote.hatIndices = hats;
            emote.intervalMs = isNaN(interval) || interval < 100 ? 550 : interval; // Default to 550ms if invalid

            return emote;
        },

        // Renders the settings menu
        renderSettingsMenu() {
            const menuId = "hax-settings";
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
            }

            menu = this.createPopup(
                menuId,
                "⚙️",
                `Settings — ${OPERATOR_LEVELS[this.operatorLevel]} ${OPERATOR_ICONS[this.operatorLevel]
                }`
            );
            const fieldsDiv = document.createElement("div");
            fieldsDiv.classList.add("fields");
            menu.appendChild(fieldsDiv);

            const settingsTitle = document.createElement("h2");
            settingsTitle.textContent = "Settings";
            settingsTitle.classList.add("settings-title");
            fieldsDiv.appendChild(settingsTitle);

            // General Settings
            fieldsDiv.appendChild(
                this.createTextInput(
                    0,
                    "Open menu key",
                    "E.g. KeyO",
                    "Click to set a key for opening the menu.",
                    TOOL_CONFIG.openMenuKey
                )
            );
            const licenseField = this.createTextInput(
                1,
                "License",
                "License key obtained from an administrator",
                "Your personal key for unlocking operator features.",
                null
            );
            licenseField.querySelector("input").readOnly = true;
            licenseField.querySelector("input").disabled = true;
            fieldsDiv.appendChild(licenseField);
            fieldsDiv.appendChild(
                this.createTextInput(
                    1,
                    "Chat key",
                    "E.g. Enter",
                    "Click to set a key for opening the chat.",
                    TOOL_CONFIG.chatKey
                )
            );
            fieldsDiv.appendChild(
                this.createRangeInput(
                    1,
                    "Block invites",
                    "Block invites from other players",
                    0,
                    2,
                    ["Never", "During matches", "Always"],
                    TOOL_CONFIG.blockInvitesLevel
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    1,
                    "Punish Invisible",
                    "Automatically punish invisible players. Disable for manual punish after detection.",
                    TOOL_CONFIG.punishInvisible
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    1,
                    "Punish Instakill",
                    "Automatically punish players with instakill. Disable for manual punish after detection.",
                    TOOL_CONFIG.punishInstakill
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    1,
                    "Punish Moon Snipe",
                    "Automatically punish moon sniping players. Disable for manual punish after detection.",
                    TOOL_CONFIG.punishMoonSnipe
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    1,
                    "Chicken boost",
                    "Enable or disable Chicken Kill Streaks. For each kill streak point a new chicken is spawned!",
                    TOOL_CONFIG.chickenKillstreaks
                )
            );

            // Customization Settings (Level 2+)
            fieldsDiv.appendChild(
                this.createTextInput(
                    2,
                    "Custom name",
                    "A custom name, e.g. <color=yellow>Banana</color>",
                    "Leave the field empty for default.",
                    TOOL_CONFIG.customName
                )
            );
            fieldsDiv.appendChild(
                this.createTextInput(
                    2,
                    "Custom rank",
                    "A custom rank, e.g. Master warrior",
                    "Leave the field empty for default.",
                    TOOL_CONFIG.customRank
                )
            );
            const maxCustomLevel = MAX_CUSTOM_LEVELS_BY_LEVEL[this.operatorLevel];
            fieldsDiv.appendChild(
                this.createNumberInput(
                    Math.max(2, this.operatorLevel),
                    "Custom level",
                    "Leave as 0 for default. (WIP, limited visiblity)",
                    0,
                    maxCustomLevel,
                    TOOL_CONFIG.customLevel
                )
            );
            fieldsDiv.appendChild(
                this.createNumberInput(
                    1,
                    "Custom room time",
                    "Override the room minutes when you host a map",
                    1,
                    80,
                    TOOL_CONFIG.customRoomMinutes
                )
            );
            fieldsDiv.appendChild(
                this.createTextInput(
                    2,
                    "Custom room name",
                    "A custom name for your room when you host a map, e.g. KILLZONE",
                    "Leave empty for default.",
                    TOOL_CONFIG.customRoomName
                )
            );
            const maxRoomLimit = MAX_ROOM_LIMITS_BY_LEVEL[this.operatorLevel];
            fieldsDiv.appendChild(
                this.createNumberInput(
                    Math.max(1, this.operatorLevel),
                    "Custom room limit",
                    "Override the room player limit when you host a map.",
                    2,
                    maxRoomLimit,
                    TOOL_CONFIG.customRoomLimit
                )
            );
            fieldsDiv.appendChild(
                this.createSelectInput(
                    2,
                    "Custom room mode",
                    "Override the room mode when you host a map.",
                    GAME_MODES.getModeListForUI(),
                    TOOL_CONFIG.customRoomMode
                )
            );

            // Fast Class Settings (Level 3+)
            const fastClassesNames = TOOL_CONFIG.fastClasses
                .map((id) => CLASSES.getName(id))
                .join(", ");
            fieldsDiv.appendChild(
                this.createTextInput(
                    3,
                    "Fast classes",
                    "A list of classes for quick swapping, e.g. brawler, soldier, hitman",
                    "Leave empty to disable fast classes.",
                    fastClassesNames
                )
            );
            fieldsDiv.appendChild(
                this.createTextInput(
                    3,
                    "Fast class key",
                    "E.g. KeyQ",
                    "Click to set a key for changing to the next fast class.",
                    TOOL_CONFIG.fastClassKey
                )
            );

            // Debug Settings (Level 5+)
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    5,
                    "Debug data send",
                    "Enable logging of sent data packets.",
                    TOOL_CONFIG.debugDataSend
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    5,
                    "Debug data receive",
                    "Enable logging of received data packets.",
                    TOOL_CONFIG.debugDataReceive
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    5,
                    "Debug JSON send",
                    "Enable logging of sent json packets.",
                    TOOL_CONFIG.debugJsonSend
                )
            );
            fieldsDiv.appendChild(
                this.createCheckboxInput(
                    5,
                    "Debug JSON receive",
                    "Enable logging of received json packets.",
                    TOOL_CONFIG.debugJsonReceive
                )
            );

            // Skin Emotes Section
            const maxSkinEmotes = MAX_SKIN_EMOTES_BY_LEVEL[this.operatorLevel];
            const skinEmotesTitle = document.createElement("h2");
            skinEmotesTitle.textContent = `Skin emotes (Max ${maxSkinEmotes})`;
            skinEmotesTitle.classList.add("skin-emotes-title");
            fieldsDiv.appendChild(skinEmotesTitle);

            const skinEmotesContainer = document.createElement("div");
            skinEmotesContainer.classList.add("skin-emotes-container");
            fieldsDiv.appendChild(skinEmotesContainer);

            TOOL_CONFIG.skinEmotes.forEach((emote) => {
                const emoteSection = this.createSkinEmoteSection(2, emote);
                skinEmotesContainer.appendChild(emoteSection);
            });

            const addEmoteButton = this.createDialogButton(
                "➕ Add emote",
                "add-emote",
                () => {
                    if (
                        skinEmotesContainer.querySelectorAll(".skin-emote").length >=
                        maxSkinEmotes
                    ) {
                        return; // Max emotes reached
                    }
                    const newEmote = new SkinEmote();
                    const newEmoteSection = this.createSkinEmoteSection(2, newEmote);
                    skinEmotesContainer.appendChild(newEmoteSection);
                    newEmoteSection.scrollIntoView({
                        behavior: "smooth",
                        block: "end",
                    });
                }
            );
            fieldsDiv.appendChild(addEmoteButton);
            if (maxSkinEmotes < 1) {
                addEmoteButton.disabled = true;
                addEmoteButton.title = "Your license does not allow skin emotes.";
            }

            // Action Buttons
            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("buttons");
            menu.appendChild(buttonsDiv);

            const cancelButton = this.createDialogButton("Cancel", "cancel", () => {
                this.closePopup(menuId);
            });
            buttonsDiv.appendChild(cancelButton);

            const saveButton = this.createDialogButton(
                "Save settings",
                "accept",
                async () => {
                    // Retrieve all values from UI fields and update TOOL_CONFIG
                    TOOL_CONFIG.openMenuKey = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(2)")
                    ); // Assuming order
                    TOOL_CONFIG.chatKey = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(4)")
                    );
                    TOOL_CONFIG.blockInvitesLevel = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(5)")
                    );
                    TOOL_CONFIG.punishInvisible = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(6)")
                    );
                    TOOL_CONFIG.punishInstakill = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(7)")
                    );
                    TOOL_CONFIG.punishMoonSnipe = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(8)")
                    );
                    TOOL_CONFIG.chickenKillstreaks = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(9)")
                    );

                    TOOL_CONFIG.customName = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(10)")
                    );
                    TOOL_CONFIG.customRank = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(11)")
                    );
                    TOOL_CONFIG.customLevel = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(12)")
                    );
                    TOOL_CONFIG.customRoomMinutes = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(13)")
                    );
                    TOOL_CONFIG.customRoomName = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(14)")
                    );
                    TOOL_CONFIG.customRoomLimit = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(15)")
                    );
                    TOOL_CONFIG.customRoomMode = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(16)")
                    );

                    const fastClassesRaw = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(17)")
                    );
                    TOOL_CONFIG.fastClasses = fastClassesRaw
                        .split(/[\s,]+/)
                        .map((name) => CLASSES.getId(name.trim()))
                        .filter((id) => id !== CLASSES.NONE);
                    TOOL_CONFIG.fastClassKey = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(18)")
                    );

                    TOOL_CONFIG.debugDataSend = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(19)")
                    );
                    TOOL_CONFIG.debugDataReceive = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(20)")
                    );
                    TOOL_CONFIG.debugJsonSend = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(21)")
                    );
                    TOOL_CONFIG.debugJsonReceive = this.getFieldValue(
                        fieldsDiv.querySelector("label:nth-child(22)")
                    );

                    // Extract skin emotes
                    TOOL_CONFIG.skinEmotes = [];
                    const emoteSections =
                        skinEmotesContainer.querySelectorAll(".skin-emote");
                    for (const section of emoteSections) {
                        const emote = this.getSkinEmoteDataFromSection(section);
                        TOOL_CONFIG.skinEmotes.push(emote);
                    }

                    // Save settings to local storage
                    await this.saveSettings();
                    this.closePopup(menuId);
                    this.showMessage("<color=yellow>Settings saved.");
                }
            );
            buttonsDiv.appendChild(saveButton);

            document.body.appendChild(menu);
            menu.focus(); // Focus the popup
        },

        // Renders the password change menu
        renderPasswordChangeMenu() {
            const menuId = "hax-password-change";
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
            }

            menu = this.createPopup(menuId, "🔑", "Change password");
            menu.classList.add("password-change");
            const fieldsDiv = document.createElement("div");
            fieldsDiv.classList.add("fields");
            menu.appendChild(fieldsDiv);

            const currentPasswordField = this.createPasswordField(
                1,
                "Current password",
                "Enter your current password",
                "Your current password.",
                decodeXORString([], 0x39)
            ); // Decodes to ''
            fieldsDiv.appendChild(currentPasswordField);
            const newPasswordField = this.createPasswordField(
                1,
                "New password",
                "Enter your new password",
                "Your new password.",
                decodeXORString([], 0x68)
            ); // Decodes to ''
            fieldsDiv.appendChild(newPasswordField);
            const confirmPasswordField = this.createPasswordField(
                1,
                "Confirm password",
                "Re-enter your new password",
                "Re-enter your new password.",
                decodeXORString([], 0xd3)
            ); // Decodes to ''
            fieldsDiv.appendChild(confirmPasswordField);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("buttons");
            menu.appendChild(buttonsDiv);

            const cancelButton = this.createDialogButton("Cancel", "cancel", () => {
                this.closePopup(menuId);
            });
            buttonsDiv.appendChild(cancelButton);

            const changePasswordButton = this.createDialogButton(
                "Change password",
                "accept",
                async () => {
                    const currentPassword = this.getFieldValue(currentPasswordField);
                    const newPassword = this.getFieldValue(newPasswordField);
                    const confirmPassword = this.getFieldValue(confirmPasswordField);

                    try {
                        if (newPassword !== confirmPassword) {
                            throw Error("New passwords do not match!");
                        }
                        if (!currentPassword || !newPassword) {
                            throw Error("Please fill in all fields!");
                        }

                        // Firebase password update logic
                        await (async (currentPass, newPass) => {
                            const user = globalWindow.firebase.auth().currentUser;
                            const credential =
                                globalWindow.firebase.auth.EmailAuthProvider.credential(
                                    user.email,
                                    currentPass
                                );
                            await user.reauthenticateWithCredential(credential); // Re-authenticate
                            await user.updatePassword(newPass); // Update password
                        })(currentPassword, newPassword);

                        this.closePopup(menuId);
                        this.showMessage("<color=green>Password updated successfully.");
                    } catch (error) {
                        alert(error.message);
                    }
                }
            );
            buttonsDiv.appendChild(changePasswordButton);

            document.body.appendChild(menu);
        },

        // Renders the "Clan Rape" menu (for joining clans)
        renderClanRapeMenu() {
            const menuId = "hax-gate-crash";
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
            }

            menu = this.createPopup(menuId, "🏰", "Clan rape");
            document.body.appendChild(menu);

            const fieldsDiv = document.createElement("div");
            fieldsDiv.classList.add("fields");
            menu.appendChild(fieldsDiv);

            const clanInputField = this.createTextInput(
                4,
                "Clan",
                "Enter a clan to join",
                "This will rape the clan. Please ask for consent first.",
                decodeXORString([], 0xa9)
            ); // Decodes to ''
            fieldsDiv.appendChild(clanInputField);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("buttons");
            menu.appendChild(buttonsDiv);

            const cancelButton = this.createDialogButton("Cancel", "cancel", () => {
                this.closePopup(menuId);
            });
            buttonsDiv.appendChild(cancelButton);

            const forceJoinButton = this.createDialogButton(
                "Force join",
                "accept",
                async () => {
                    const clanName = this.getFieldValue(clanInputField);
                    try {
                        // Firebase clan update logic
                        await (async (path, value) => {
                            const user = globalWindow.firebase.auth().currentUser;
                            // 'FirebaseHammer: User must be authenticated before setting data.' (original comment)
                            const db = globalWindow.firebase.database();
                            const refPath = `users/${user.uid}/${path}`;
                            try {
                                await db.goOffline(); // Go offline to prevent immediate sync
                                await db.ref(refPath).remove(); // Remove existing clan
                                if (value !== null) {
                                    await db.ref(refPath).set(value); // Set new clan
                                }
                                await db.goOnline(); // Go online
                                globalWindow.showUserDetails(user.email, user); // Update user details
                            } catch (e) {
                                // Error handling
                            }
                            globalWindow.showUserDetails(user.email, user); // Redundant call
                        })("public/clan", clanName);

                        this.closePopup(menuId);
                        this.showMessage("<color=green>Clan joined successfully.");
                        alert("Please reload for changes to reflect.");
                    } catch (error) {
                        alert(error.message);
                    }
                }
            );
            buttonsDiv.appendChild(forceJoinButton);

            document.body.appendChild(menu);
        },

        // Renders the license administration menu for a player
        showLicenseAdminMenu(player) {
            const menuId = "hax-license-admin";
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
            }

            menu = this.createPopup(
                menuId,
                "🔒",
                `Manage license for ${player.displayName}`
            );
            menu.classList.add("license-admin");
            const fieldsDiv = document.createElement("div");
            fieldsDiv.classList.add("fields");
            menu.appendChild(fieldsDiv);

            const maxLevelToGrant = this.currentOperatorLevel; // Max level current user can grant
            const levelOptions = OPERATOR_LEVELS.slice(0, maxLevelToGrant + 1).map(
                (name, index) => ({
                    label: `${OPERATOR_ICONS[index]} ${name}`,
                    value: index,
                })
            );
            const grantLevelField = this.createSelectInput(
                this.operatorLevel,
                "Grant level",
                "The operator level to grant for this license.",
                levelOptions,
                player.operatorLevel
            );
            fieldsDiv.appendChild(grantLevelField);

            const maxDaysToGrant = [0, 0, 0, 30, 180, 365][this.currentOperatorLevel]; // Max days based on current user's level
            const grantDaysField = this.createNumberInput(
                this.operatorLevel,
                "Grant days",
                "The number of days to grant for this license.",
                1,
                maxDaysToGrant,
                7
            );
            fieldsDiv.appendChild(grantDaysField);

            const grantAdminField = this.createCheckboxInput(
                this.operatorLevel,
                "Grant admin",
                "Grant admin privileges to this user.",
                false
            );
            if (this.currentOperatorLevel < 5) {
                // Only Developer King can grant admin
                grantAdminField.style.display = "none";
            }
            fieldsDiv.appendChild(grantAdminField);

            const buttonsDiv = document.createElement("div");
            buttonsDiv.classList.add("buttons");
            menu.appendChild(buttonsDiv);

            const cancelButton = this.createDialogButton("Cancel", "cancel", () => {
                this.closePopup(menuId);
            });
            buttonsDiv.appendChild(cancelButton);

            const grantLicenseButton = this.createDialogButton(
                "Grant license",
                "accept",
                async () => {
                    const selectedLevel = this.getFieldValue(grantLevelField);
                    if (
                        selectedLevel === null ||
                        selectedLevel < 0 ||
                        selectedLevel > this.currentOperatorLevel
                    ) {
                        throw Error("Invalid operator level selected.");
                    }
                    const selectedDays = this.getFieldValue(grantDaysField);
                    if (
                        selectedDays === null ||
                        selectedDays < 1 ||
                        selectedDays > maxDaysToGrant
                    ) {
                        throw Error("Invalid number of days selected.");
                    }
                    const grantAdmin =
                        this.currentOperatorLevel === 5 &&
                        this.getFieldValue(grantAdminField);

                    await this.grantLicense(
                        player,
                        selectedLevel,
                        grantAdmin,
                        selectedDays
                    );
                    this.closePopup(menuId);
                }
            );
            buttonsDiv.appendChild(grantLicenseButton);

            document.body.appendChild(menu);
        },

        // Toggles the chat input field visibility
        toggleChatInput() {
            const chatInputId = "chat-input";
            const existingInput = document.getElementById(chatInputId);
            if (existingInput) {
                return existingInput.focus(); // Focus if already open
            }

            const chatContainerId = "hax-chat";
            const chatContainer = document.createElement("div");
            chatContainer.id = chatContainerId;

            const inputField = document.createElement("input");
            inputField.id = chatInputId;
            inputField.type = "text";
            inputField.classList.add("chat-input");
            inputField.placeholder = "Enter text...";
            chatContainer.appendChild(inputField);

            const sendMessage = () => {
                let message = inputField.value.trim();
                if (message) {
                    if (message[0] !== "!") {
                        // If not a command
                        let senderPrefix = this.localPlayer.rawName;
                        senderPrefix = `${null}<color=#ddd>`; // Original code, results in "null<color=#ddd>"
                        message = `${senderPrefix}: ${message}`;
                    } else {
                        message = message.slice(1); // Remove '!' for commands
                    }
                    this.sendChatMessage(message);
                }
                this.closeChatInput();
            };

            chatContainer.addEventListener(
                "keydown",
                (e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    if (e.key === "Enter") {
                        sendMessage();
                        e.preventDefault();
                        e.stopPropagation();
                    } else if (e.key === "Escape") {
                        this.closeChatInput();
                        e.preventDefault();
                        e.stopPropagation();
                    }
                },
                true
            ); // Use capture phase

            document.body.appendChild(chatContainer);
            document.getElementById("unity-canvas").blur(); // Blur Unity canvas
            inputField.focus();
        },

        // Closes the chat input field
        closeChatInput() {
            const chatContainerId = "hax-chat";
            const chatContainer = document.getElementById(chatContainerId);
            if (chatContainer) {
                chatContainer.remove();
            }
        },

        // Displays a custom message in the game UI
        showMessage(message) {
            sendUnityMessage("MainManager", "ShowMessageCustom", message);
        },

        // Shows another player's user profile in the game
        showUserProfile(player) {
            sendUnityMessage("MapScripts", "ShowOtherUserProfile", player.uid);
        },

        // --- Custom Command Execution ---
        async executeCustomCommand(command, sourcePlayer, args) {
            switch (command) {
                case CUSTOM_COMMAND_PROTOCOL.GET_VERSION:
                    this.sendCustomCommand(
                        CUSTOM_COMMAND_PROTOCOL.REPLY_INFO,
                        sourcePlayer,
                        [TOOL_VERSION, null ?? decodeXORString([], 0x89)]
                    ); // Decodes to ''
                    break;
                case CUSTOM_COMMAND_PROTOCOL.REPLY_INFO:
                    {
                        const toolVersion = args[0];
                        const licenseData =
                            args.length > 1 ? args[1] : decodeXORString([], 0x71); // Decodes to ''
                        sourcePlayer.toolVersion = toolVersion;
                        this.showMessage(
                            `${sourcePlayer.rawName} is using <color=orange>${toolVersion}</color>`
                        );
                        try {
                            if (!licenseData) {
                                throw Error("No key data");
                            }
                            const licenseInfo = await this.validateLicense(
                                sourcePlayer.uid,
                                licenseData
                            );
                            sourcePlayer.operatorLevel = licenseInfo.level;
                            const levelName = OPERATOR_LEVELS[licenseInfo.level];
                            this.showMessage(
                                `${sourcePlayer.rawName
                                } is a <color=green>${levelName}</color> until ${licenseInfo.expires.toLocaleDateString()}`
                            );
                        } catch (error) {
                            sourcePlayer.operatorLevel = 1; // Default to Nubie if license invalid
                            this.showMessage(
                                `${sourcePlayer.rawName} : <color=red>${error.message}</color>`
                            );
                        }
                        this.updatePlayerUI(sourcePlayer);
                    }
                    break;
                case CUSTOM_COMMAND_PROTOCOL.SET_KEY:
                    {
                        const newLicenseKey = args[0];
                        try {
                            await this.validateLicense(this.userId, newLicenseKey); // Validate for local user
                            await this.updateLicenseKey(newLicenseKey); // Update local storage
                            await this.loadLicenseAndLevel(); // Reload local license
                            await this.loadSettings(); // Reload local settings
                            this.showMenuTemporarily(true, 0);
                            this.sendCustomCommand(
                                CUSTOM_COMMAND_PROTOCOL.REPLY_INFO,
                                sourcePlayer,
                                [TOOL_VERSION, null ?? decodeXORString([], 0x82)]
                            ); // Decodes to ''
                        } catch (error) {
                            // Handle error
                        }
                    }
                    break;
                case CUSTOM_COMMAND_PROTOCOL.BAN_PLAYER:
                    {
                        const banLicenseKey = args[0];
                        const banReason = args[1];
                        try {
                            await this.validateLicense(this.userId, banLicenseKey); // Validate for local user
                            await this.updateLicenseKey(null); // Clear local license
                            await this.loadLicenseAndLevel(); // Reload local license
                            await this.loadSettings(); // Reload local settings
                            this.sendCustomCommand(
                                CUSTOM_COMMAND_PROTOCOL.REPLY_INFO,
                                sourcePlayer,
                                [TOOL_VERSION, null ?? decodeXORString([], 0xc5)]
                            ); // Decodes to ''
                            await this.banUser(banReason); // Ban local user
                        } catch (error) {
                            // Handle error
                        }
                    }
                    break;
            }
        },

        // Sends a custom command message to a player
        sendCustomCommand(command, targetPlayer, args) {
            const commandArgs = [
                command,
                targetPlayer?.id ?? 0,
                this.localPlayer.id,
                ...args,
            ];
            let messageContent =
                CUSTOM_COMMAND_PROTOCOL.PREFIX +
                commandArgs.join(CUSTOM_COMMAND_PROTOCOL.DELIMITER);
            this.showMessage(messageContent); // Display the command in chat (for debug/visibility)
        },
    };

    // --- Global Event Listeners and Initialization ---

    // Override native WebSocket to intercept game and Firebase traffic
    globalWindow.WebSocket = class InterceptedWebSocket extends WebSocket {
        static gameWebSocket = null;
        static firebaseWebSocket = null;

        constructor(...args) {
            super(...args);
            this.addEventListener("open", (event) => {
                if (this.url.includes("exitgames")) {
                    KaleidoTools.interceptGameWebSocket(this);
                    this.constructor.gameWebSocket = this;
                } else if (this.url.includes("firebaseio.com")) {
                    KaleidoTools.interceptFirebaseWebSocket(this);
                    this.constructor.firebaseWebSocket = this;
                }
            });
            this.addEventListener("close", (event) => {
                if (this === this.constructor.gameWebSocket) {
                    KaleidoTools.cleanupGameWebSocket(this);
                    this.constructor.gameWebSocket = null;
                } else if (this === this.constructor.firebaseWebSocket) {
                    KaleidoTools.cleanupFirebaseWebSocket(this);
                    this.constructor.firebaseWebSocket = null;
                }
            });
        }
    };

    // Callback when a map starts playing
    globalWindow.onMapPlayStarted = function (mapName) {
        KaleidoTools.isMapPlaying = true;
        KaleidoTools.showMenuTemporarily(false, 100); // Show menu briefly
    };

    // Callback when a map ends
    globalWindow.onMapPlayEnd = function () {
        KaleidoTools.isMapPlaying = false;
        KaleidoTools.showMenuTemporarily(false, 100); // Show menu briefly
    };

    // Global keydown listener (using capture phase to ensure it runs first)
    document.addEventListener(
        "keydown",
        (event) => {
            // If the event target is an input or textarea, let it handle the keydown
            if (!event.target.matches("input, textarea")) {
                if (KaleidoTools.handleKeyboardEvent(event) && false) {
                    // The '&& false' is from original code, might be a debug flag
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        },
        {
            capture: true,
        }
    ); // Capture phase

    // Prevent default behavior for keyboard events in input fields
    (function () {
        const originalPreventDefault = Event.prototype.preventDefault;
        Event.prototype.preventDefault = function () {
            // If it's a keyboard event and the active element is an input/textarea/contenteditable,
            // and the event target is NOT the active element, then don't prevent default.
            // This allows the tool's hotkeys to work without interfering with typing in inputs.
            if (
                !(
                    this instanceof KeyboardEvent ||
                    this.type === "beforeinput" ||
                    this.type === "input"
                ) ||
                !(
                    document.activeElement &&
                    (document.activeElement.tagName === "INPUT" ||
                        document.activeElement.tagName === "TEXTAREA" ||
                        document.activeElement.isContentEditable)
                ) ||
                this.target !== document.activeElement
            ) {
                return originalPreventDefault.call(this);
            }
        };

        // Stop immediate propagation for keyboard events in inputs/textareas
        const keyboardEventTypes = ["keydown", "keypress", "keyup", "beforeinput"];
        for (const type of keyboardEventTypes) {
            document.addEventListener(
                type,
                function (event) {
                    const activeElement = document.activeElement;
                    if (
                        activeElement &&
                        (activeElement.tagName === "INPUT" ||
                            activeElement.tagName === "TEXTAREA" ||
                            activeElement.isContentEditable) &&
                        event.target !== activeElement
                    ) {
                        event.stopImmediatePropagation();
                    }
                },
                true
            ); // Use capture phase
        }
    })();

    (function initializeFirebaseAuth(
        retryCount = 0,
        maxRetries = 30,
        delay = 1000
    ) {
        if (
            globalWindow.firebase &&
            globalWindow.firebase.auth &&
            globalWindow.unityInstance
        ) {
            globalWindow.firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    console.log("loggedin");
                    await KaleidoTools.initializeUser(user);
                } else {
                    console.log("loggedout");
                    await KaleidoTools.logoutUser();
                }
            });
        } else if (retryCount < maxRetries) {
            console.log(`Retrying Firebase auth init... attempt ${retryCount + 1}`);
            setTimeout(
                () => initializeFirebaseAuth(retryCount + 1, maxRetries, delay),
                delay
            );
        } else {
            console.warn("Firebase auth initialization failed after maximum retries");
        }
    })();

    // --- CSS Styling Injection ---
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(`
    .hax-popup {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%); /* Use transform for centering */
        background: linear-gradient(145deg, #1e1e1e, #333);
        padding: 0px;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 -4px 6px rgba(0, 0, 0, 0.2);
        color: lightgrey;
        font-family: monospace;
        font-size: 16px;
        z-index: 3000;
        display: flex;
        flex-direction: column;
    }

    .hax-popup .titlebar {
        background: #1e1e1e;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        height: 35px;
        display: flex;
        justify-content: space-between;
    }

    .hax-popup span {
        display: inline-block;
    }

    .hax-popup .title-text {
        margin: 8px 5px;
        color: #c9ae1c;
        display: inline;
    }

    .hax-popup .title-icon {
        font-size: 18px;
        margin: 5px;
        cursor: default;
    }

    .hax-popup .title-close-button {
        background: none;
        padding: 0px;
        color: lightgrey;
        cursor: pointer;
        border: none;
        margin: 5px;
        font-size: 18px;
        width: 30px;
        border-radius: 5px;
        margin: 5px;
    }

    .hax-popup .title-close-button:hover {
        color: whitesmoke;
        background: #3f3f3f;
    }

    .hax-popup .fields {
        padding: 20px;
        display: flex;
        flex-direction: column;
        max-height: 50vh;
        overflow-y: auto;
    }

    .hax-popup .buttons {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 5px;
        border-top: 1px solid #444;
    }

    .hax-popup .icon-button {
        background: #2c82526b; /* Semi-transparent green */
        border: none;
        cursor: pointer;
        width: 30px;
        height: 30px;
        font-size: 18px;
        border-radius: 5px;
        margin: 5px;
    }

    .hax-popup .icon-button:hover {
        background-color: #186a18;
    }

    .hax-popup .icon-button:active {
        background-color: #145a14;
    }

    .hax-popup .icon-button:disabled {
        background-color: #1e1e1e !important;
        cursor: default;
    }

    .hax-popup .dialog-button {
        background: #666;
        color: whitesmoke;
        border: none;
        cursor: pointer;
        font-size: 18px;
        border-radius: 5px;
        margin: 5px;
        padding: 10px;
        width: 10em;
    }

    .hax-popup .dialog-button:hover {
        background: #777;
    }

    .hax-popup .dialog-button:active {
        background: #555;
    }

    .hax-popup .dialog-button:disabled {
        background: #333 !important;
        cursor: default;
    }

    .hax-popup .dialog-button.accept {
        background: #2c82526b;
    }

    .hax-popup .dialog-button.accept:hover {
        background-color: #186a18;
    }

    .hax-popup .dialog-button.accept:active {
        background-color: #145a14;
    }

    .hax-popup .dialog-button.cancel {}

    .hax-popup .dialog-button.cancel:hover {}

    .hax-popup .dialog-button.delete {
        background: #882b2b;
    }

    .hax-popup .dialog-button.delete:hover {
        background-color: #8c0808;
    }

    .hax-popup .dialog-button.delete:active {
        background-color: #7a0000;
    }

    .hax-popup .input-field {
        margin: 5px;
        padding: 10px;
        border: none;
        border-radius: 5px;
        background-color: #444;
        color: whitesmoke;
        font-size: 20px;
        font-family: monospace;
    }

    .hax-popup .clear-button {
        background: none;
        border: none;
        cursor: pointer;
        color: lightgrey;
        font-size: 18px;
        width: 30px;
        display: none;
    }

    .hax-popup .text-clear button {
        margin: 0 -15px;
        transform: translateX(-30px); /* Use transform for positioning */
    }

    .hax-popup .no-clear button {
        display: none !important;
    }

    .hax-popup .clear-button:hover {
        color: white;
    }

    .hax-popup .label {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .hax-popup .input-wrapper {
        display: flex;
        align-items: center;
        width: 80%;
    }

    .hax-popup .label-text {
        width: 200px;
    }

    .hax-popup .text-field {
        width: 100%;
    }

    .hax-popup .password-field {
        width: 100%;
    }

    .hax-popup .number-field {
        width: 200px;
    }

    .hax-popup .slider-field {
        width: 200px;
    }

    .hax-popup .slider-value-text {
        width: 200px;
        margin-left: 10px;
    }

    .hax-popup .checkbox-field {
        width: 20px;
        height: 20px;
        margin-right: 10px;
    }

    .hax-popup .select-input {
        display: none;
    }

    .hax-popup .skin-emote {
        border: 1px solid #444;
        padding: 10px;
        margin: 10px;
    }

    .hax-popup .emote-buttons {
        display: flex;
        align-items: flex-end; /* Use flex-end for alignment */
        width: 100%;
        flex-direction: column;
    }

    .overlay {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2000;
    }

    #hax-menu {
        top: auto;
        left: auto;
        transform: none; /* Reset transform for positioning */
        bottom: 10vh;
        right: 10px;
        min-width: 250px;
        max-width: 400px;
        z-index: 1000;
    }

    #hax-players-wrapper {
        max-height: 30vh;
        overflow-y: auto;
        display: grid;
    }

    #hax-players {
        table-layout: fixed;
        margin: 5px 10px 5px 5px;
        padding: 0;
        border: none;
    }

    .hidden {
        display: none;
    }

    #hax-players .icon-col {
        width: 25px;
    }

    #hax-players .player-button {
        width: 100%;
        padding: 5px;
        border: none;
        border-radius: 5px;
        color: lightgrey;
        font-size: 14px;
        transition: all 0.3s;
        cursor: pointer;
        background-color: #444;
    }

    #hax-players .player-button:hover {
        background-color: #555;
    }

    #hax-players .player-button:disabled {
        background-color: #333;
    }

    #hax-players .player-button.protected {
        background-color: darkgreen;
    }

    #hax-players .player-button.naughty {
        background-color: #bf6a00;
    }

    #hax-players .player-button.cheater {
        background-color: darkred;
    }

    #hax-players .player-button .state {}

    #hax-players .player-button .name {
        margin: 0px 10px;
    }

    #hax-players .player-button .dead {
        text-decoration: line-through;
    }

    #hax-players .player-button .tools::before {
        content: "⚙️";
        margin-right: 5px;
    }

    #hax-players .player-button .cheats {}

    #main-message, #nobody {
        text-align: center;
        margin: 25px 20px;
    }

    #hax-settings {
        width: 50vw;
    }

    #hax-password-change {
        width: 30vw;
    }

    #hax-chat {
        bottom: 8vh;
        left: 1vh;
        width: 36vh;
        padding: 0px;
        font-size: 16px;
        position: fixed;
    }

    #hax-chat .chat-input {
        margin: 0px;
        padding: 10px;
        border: none;
        border-radius: 5px;
        background-color: #444;
        color: lightgrey;
        font-size: 20px;
        font-family: monospace;
        width: 100%;
        height: 4vh;
    }

    #hax-player-menu {
        position: absolute;
        z-index: 4000;
        background-color: #fff;
        border: 1px solid #ccc;
        box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
        padding: 0;
        margin: 0;
        width: max-content;
        border-radius: 6px;
        transform: translate(-100%, -100%); /* Use transform for positioning */
    }

    #hax-player-menu ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    #hax-player-menu li {
        padding: 10px;
        cursor: pointer;
    }

    #hax-player-menu li:hover {
        background-color: #555;
    }

    .menu-item.disabled {
        pointer-events: none;
        opacity: 0.3;
    }
  `);
    document.adoptedStyleSheets = [styleSheet];

    // Expose the main KaleidoTools object globally (original 'aa' property)
    globalWindow.aa = KaleidoTools;
})();
