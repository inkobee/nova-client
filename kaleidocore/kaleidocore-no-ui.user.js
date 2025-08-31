// ==UserScript==
// @name         Kaleido decoded tool - simplified
// @author       inkobee
// @match        https://kour.io/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// ==/UserScript==

// Immediately-invoked function expression (IIFE) to create a private scope
(function () {
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
        WEAPON_EXCLUSION_IDS: [0xcafe, 0xbabe, 0xdead],
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
        isCheater = 0; // Flag for detected cheats
        lastDeathTime = null; // Timestamp of last death
        bounty = 0; // Points for killing this player
        isInvisible = false; // Cheat detection flag
        invisibleCount = 0; // Count of invisibility detections
        isInstakilling = false; // Cheat detection flag
        instakillCount = 0; // Count of instakill detections
        isMoonSniping = false; // Cheat detection flag
        moonSnipeCount = 0; // Count of moon snipe detections
        lastActionTime = 0; // Timestamp of last action
        lastDamageTime = 0; // Timestamp of last damage
        lastWeaponId = 0;
        lastActionId = 0;
        lastTimestamp = 0; // Last timestamp from server message
        isDead = false;

        constructor(id) {
            this.id = id;
            this.setName(null); // Initialize name
        }

        setName(name) {
            if (!(name !== null && name !== "")) {
                name = `Guest_${this.id}`;
            }
            this.rawName = name; // Original name, potentially with HTML tags
            let cleanName = name.replace(/<[^>]+>/g, ""); // Remove HTML tags
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
                this.moonSnipeCount
            );
        }

        // Checks if any cheat flags are active
        get hasActiveCheats() {
            return (
                this.isInvisible ||
                this.isInstakilling ||
                this.isMoonSniping
            );
        }

        // Resets all cheat detection flags
        resetCheatFlags() {
            this.isInvisible = false;
            this.isInstakilling = false;
            this.isMoonSniping = false;
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
                        ""
                    )).replace(/\.[a-zA-Z0-9]{1,4}$/, "")).replace(
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

    // --- Main WebSocket Module ---
    const WebSocketModule = {
        currentUser: null,
        isGameWebSocketActive: false,
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
        get isLoggedIn() { return true; },
        get userId() { return "local"; },

        // --- WebSocket Interception ---

        // Intercepts game WebSocket messages (binary)
        interceptGameWebSocket(ws) {
            this.isGameWebSocketActive = true;
            const originalSend = ws.send;
            const originalOnMessage = ws.onmessage;

            ws.onmessage = (event) => {
                const data = new Uint8Array(event.data);
                // Only process if data exists, user is logged in, and tamper check passes
                if (data.length === 0) {
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
                if (byteArray.length === 0) {
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

        // Processes incoming game binary messages
        processIncomingGameMessage(data) {
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

                        } else if (this.localPlayer.tag === killedPlayerTag) {
                            this.localPlayer.lastDeathTime = Date.now(); // Local player died
                            this.playerWhoKilledMe = player; // Store who killed local player
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
            if (!GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp)) {
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

            if (player.isCheater) {
                // If player was previously marked as cheater
                this.punishPlayer(player); // Re-punish them
            }
            return null; // Consume message
        },

        // Handles player join messages
        handlePlayerJoin(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const player = this.getPlayer(playerId, "join"); // Get or create player object
            this.updatePlayerInfo(player, playerData); // Update player details
            this.updateRoomInfo(playerData); // Update room info

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

                            this.punishPlayer(player);
                        }
                    }
                }
            }
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
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            WebSocket.gameWebSocket.send(byteArray);
        },

        // Simulates receiving a hexadecimal string as a binary message
        simulateReceiveHexGameMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            const ws = WebSocket.gameWebSocket;
            const event = new MessageEvent("message", {
                data: byteArray,
                origin: new URL(ws.url).origin,
                lastEventId: "", // Empty string
                source: null,
                ports: [],
            });
            ws.dispatchEvent(event);
        },

        // Processes a hexadecimal string as an outgoing message
        processHexOutgoingMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            this.processOutgoingGameMessage(byteArray);
        },

        // Processes a hexadecimal string as an incoming message
        processHexIncomingMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            this.processIncomingGameMessage(byteArray);
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
                let currentChunk = ""; // Empty string
                for (let part of parts) {
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

        // Resets player list and clears other player data
        resetPlayerListAndData() {
            this.localPlayer.id = 0;
            this.otherPlayers.clear();
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

            }
        },

        // Applies punishment to a player based on detected cheats
        punishPlayer(player) {
            let reason = "his sins";
            if (player.isInvisible) {
                reason = "invisibility";
            } else if (player.isInstakilling) {
                reason = "instakilling";
            } else if (player.isMoonSniping) {
                reason = "moon sniping";
            }

            const punishmentMessage = `<color=#e70aff>${player.rawName}</color><color=green> was <color=red>punished</color> for ${reason}.`;
            this.sendChatMessage(punishmentMessage);

            console.log("killing");
            this.damagePlayer(player, 250, 1); // Deal damage
            this.killPlayer(player); // Kill player
            if (player.isInvisible) {
                console.log("teleporting");
                this.teleportPlayer(player, false); // Teleport to invalid location
            }
        },

        // "Nukes" all clients (teleports them to infinity)
        nukeAllClients() {
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

        },
    };

    // --- Global Event Listeners and Initialization ---

    // Override native WebSocket to intercept game and Firebase traffic
    globalWindow.WebSocket = class InterceptedWebSocket extends WebSocket {
        static gameWebSocket = null;

        constructor(...args) {
            super(...args);
            this.addEventListener("open", (event) => {
                if (this.url.includes("exitgames")) {
                    WebSocketModule.interceptGameWebSocket(this);
                    this.constructor.gameWebSocket = this;
                }
            });
            this.addEventListener("close", (event) => {
                if (this === this.constructor.gameWebSocket) {
                    WebSocketModule.cleanupGameWebSocket(this);
                    this.constructor.gameWebSocket = null;
                }
            });
        }
    };

    // Callback when a map starts playing
    globalWindow.onMapPlayStarted = function (mapName) {
        WebSocketModule.isMapPlaying = true;
    };

    // Callback when a map ends
    globalWindow.onMapPlayEnd = function () {
        WebSocketModule.isMapPlaying = false;
    };

    // Expose the main WebSocketModule object globally (original 'aa' property)
    globalWindow.aa = WebSocketModule;
})();
