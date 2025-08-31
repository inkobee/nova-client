// ==UserScript==
// @name        Myrrr Full Control
// @match       *://kour*.io/*
// @author      myrrr
// @run-at      document-start
// @require     https://pastebin.com/raw/y6GPbGKE
// ==/UserScript==

const FIXED_KEY = 0x12345678; //W key

const recoilFields = [
    { label: "Initial Return Speed", offset: 0xBC, type: "f32", min: 0, max: 1000, step: 1 },
    { label: "currentRecoil", offset: 0xA4, type: "ObscuredFloat", min: 0, max: 1000, step: 1 },
];

const healthFields = [
    { label: "Max Health", offset: 0x58, type: "ObscuredInt", min: 0, max: 1000, step: 50 },
    { label: "Current Health", offset: 0x6C, type: "ObscuredInt", min: 0, max: 1000, step: 50 },
];

const shooterFields = [
    { label: "Shooting Timer", offset: 0xE8, type: "ObscuredFloat", min: 0, max: 1000, step: 50 },
    //{ label: "Current Fire Rate", offset: 0x100, type: "ObscuredFloat", min: -1000, max: 1000, step: 10 },
    //{ label: "Current Range", offset: 0x118, type: "ObscuredFloat", min: 0, max: 50000, step: 100 },
    { label: "Current Reload Time", offset: 0x130, type: "ObscuredFloat", min: 0, max: 10, step: 1 },
    { label: "Current Damage", offset: 0x148, type: "ObscuredInt", min: 0, max: 1000, step: 1 },
    //{ label: "Change Weapon Timer", offset: 0x15C, type: "ObscuredFloat", min: 0, max: 1000, step: 1 },
    //{ label: "Last Shoot Time", offset: 0x1B8, type: "f32", min: 0, max: 1000, step: 1 },
    //{ label: "Current Kill Row", offset: 0x1E0, type: "i32", min: 0, max: 100, step: 1 },
    { label: "Neck Network X Rotation", offset: 0x204, type: "i32", min: -84, max: 44, step: 1 },
    { label: "Enemy Neck Network X Rotation", offset: 0x1C0, type: "i32", min: -84, max: 44, step: 1 },
];

const playerControllerFields = [
    { label: "Air Acceleration", offset: 0x70, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Air Friction", offset: 0x74, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Air Limit", offset: 0x84, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Initial Air Limit", offset: 0x88, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Initial Air Acceleration", offset: 0x8C, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Ground Acceleration", offset: 0x6C, type: "f32", min: 0, max: 2000, step: 1 },
    { label: "Ground Limit", offset: 0x78, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Crouch Ground Limit", offset: 0x7C, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Initial Ground Limit", offset: 0x80, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Friction", offset: 0x98, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Gravity", offset: 0x94, type: "f32", min: -50, max: 50, step: 1 },
    { label: "Jump Height", offset: 0x9C, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Ramp Slide Limit (air controll strenght)", offset: 0xA0, type: "f32", min: 0, max: 1000, step: 10 },
    { label: "Slope Limit", offset: 0xA4, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Current Instability", offset: 0xE8, type: "f32", min: 0, max: 100, step: 0.1 },
    { label: "Dash Mana", offset: 0xF0, type: "f32", min: 0, max: 1000, step: 1 },
    { label: "Inacc + clouds", offset: 189, type: "f32", min: 30, max: 50, step: 20 },
];

const mapInfoFields = [
    { label: "Match Time (Seconds)", offset: 0x128, type: "i32", min: 0, max: 36000000, step: 10 },
];

const thirdPersonCameraFields = [
    { label: "Initial Camera Length", offset: 0x48, type: "f32", min: 0, max: 100, step: 1 },
    { label: "Camera Height", offset: 148, type: "f32", min: 0, max: 100, step: 1 },
];

const weaponSwayFields = [
    { label: "Sway Amount", offset: 0x3C, type: "f32", min: 1, max: 100, step: 1 },
    { label: "Move Sway Amount", offset: 0x40, type: "f32", min: 0, max: 10, step: 1 },
];





let currentValues = {};
let myrrr = null;
let panelVisible = true;
let panelElement = null;

const myrrrWait = setInterval(() => {
    if (window.UnityWebModkit && UnityWebModkit.Runtime) {
        clearInterval(myrrrWait);
        myrrr = UnityWebModkit.Runtime.createPlugin({
            name: "Myrrr Full Control",
            version: "1.6",
            referencedAssemblies: [
                "GameAssembly.dll",
                "System.Runtime.InteropServices.dll",
                "mscorlib.dll",
                "PhotonUnityNetworking.dll",
                "Assembly-CSharp.dll"
            ],
        });
        initUI();
        setupHooks();
        window.myrrr = myrrr;
    }
}, 100);

function writeObscuredInt(i, baseOffset, value) {
    const encrypted = value ^ FIXED_KEY;
    i.writeField(baseOffset, "i32", FIXED_KEY);        // currentCryptoKey
    i.writeField(baseOffset + 0x4, "i32", encrypted);  // hiddenValue
    i.writeField(baseOffset + 0x8, "bool", true);      // inited
    i.writeField(baseOffset + 0xC, "i32", value);      // fakeValue
    i.writeField(baseOffset + 0x10, "bool", true);     // fakeValueActive
}

function writeObscuredFloat(i, baseOffset, value) {
    const key = FIXED_KEY;
    const floatAsInt = FloatToIntBits(value);
    const encrypted = floatAsInt ^ key;

    i.writeField(baseOffset, "i32", key);         // currentCryptoKey
    i.writeField(baseOffset + 0x4, "i32", encrypted); // hiddenValue (verschlüsselt als int)
    i.writeField(baseOffset + 0x8, "bool", true);     // inited
    i.writeField(baseOffset + 0xC, "f32", value);     // fakeValue
    i.writeField(baseOffset + 0x10, "bool", true);    // fakeValueActive
}

function FloatToIntBits(f) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, f, true);
    return new DataView(buf).getInt32(0, true);
}


function setupHooks() {
    const hooks = [
        { name: "Recoil", fields: recoilFields },
        { name: "Health", fields: healthFields },
        { name: "Shooter", fields: shooterFields },
        { name: "PlayerController", fields: playerControllerFields },
        { name: "MapInfo", fields: mapInfoFields },
        { name: "ThirdPersonCamera", fields: thirdPersonCameraFields },
        { name: "WeaponSway", fields: weaponSwayFields },
    ];

    hooks.forEach(h => {
        myrrr.hookPrefix({
            typeName: h.name,
            methodName: "Update",
            params: ["i32", "i32"]
        }, i => {
            h.fields.forEach(f => {
                const key = `${h.name}-${f.offset}`;
                if (currentValues[key] !== undefined) {
                    if (f.type === "ObscuredInt") {
                        writeObscuredInt(i, f.offset, currentValues[key]);
                    }
                    else if (f.type === "ObscuredFloat") {
                        writeObscuredFloat(i, f.offset, currentValues[key]);
                    }
                    else {
                        i.writeField(f.offset, f.type, currentValues[key]);
                    }

                }
            });
        });
    });
}

function initUI() {
    panelElement = document.createElement("div");
    panelElement.style = `

        position: fixed;
        top: 50px;
        left: 40px;
        width: 300px;
        background: #1A1A28;
        color: white;
        border: 2px solid #34B2A5;
        padding: 10px;
        border-radius: 6px;
        z-index: 99999;
        font-family: Arial, sans-serif;
        max-height: 90vh;
        overflow-y: auto;
    `;
    panelElement.id = "myrrr-ui";
    panelElement.innerHTML = `<div style="text-align:center;font-weight:bold;margin-bottom:5px;color:#9FE3DC;">Myrrr Full Control</div>`;
    document.body.appendChild(panelElement);

    createFieldGroup(panelElement, "Recoil Controls", recoilFields, "Recoil");
    createFieldGroup(panelElement, "Health Controls", healthFields, "Health");
    createFieldGroup(panelElement, "Shooter Controls", shooterFields, "Shooter");
    createFieldGroup(panelElement, "PlayerController Values", playerControllerFields, "PlayerController");
    createFieldGroup(panelElement, "Map Info", mapInfoFields, "MapInfo");
    createFieldGroup(panelElement, "Third Person Camera", thirdPersonCameraFields, "ThirdPersonCamera");
    createFieldGroup(panelElement, "Weapon Sway Controls", weaponSwayFields, "WeaponSway");


    document.addEventListener("keydown", (e) => {
        if (e.code === "ShiftRight") {
            panelVisible = !panelVisible;
            panelElement.style.display = panelVisible ? "block" : "none";
        }
    });
}

function createFieldGroup(panel, title, fields, prefix) {
    panel.insertAdjacentHTML("beforeend", `<div style="font-weight:bold;color:#34B2A5;margin:10px 0 5px 0;">${title}</div>`);

    fields.forEach(f => {
        const key = `${prefix}-${f.offset}`;
        const isSlider = ["f32", "i32", "f64", "ObscuredInt", "ObscuredFloat"].includes(f.type);

        const html = isSlider
            ? `
                <label style="display:block;font-size:12px;">
                    ${f.label}: <span id="${key}">0</span>
                </label>
                <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="0" style="width:100%;">
            `
            : `
                <label style="display:block;font-size:12px;">
                    <input type="checkbox" id="${key}"> ${f.label}
                </label>
            `;

        const container = document.createElement("div");
        container.style = "margin-bottom:8px;";
        container.innerHTML = html;

        const input = container.querySelector("input");
        input.addEventListener("input", e => {
            currentValues[key] = isSlider
                ? (["i32", "ObscuredInt"].includes(f.type) ? parseInt(e.target.value) : parseFloat(e.target.value))
                : e.target.checked;

            if (isSlider) container.querySelector("span").textContent = currentValues[key];
        });

        panel.appendChild(container);
    });
}

