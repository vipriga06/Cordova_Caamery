#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Este hook se ejecuta después de preparar la plataforma Android
// y asegura que los permisos de cámara estén presentes en el AndroidManifest.xml

module.exports = function(context) {
    const manifestPath = path.join(context.opts.projectRoot, 'platforms/android/app/src/main/AndroidManifest.xml');
    
    if (!fs.existsSync(manifestPath)) {
        console.log('AndroidManifest.xml no encontrado en: ' + manifestPath);
        return;
    }
    
    let manifest = fs.readFileSync(manifestPath, 'utf-8');
    
    // Permisos a agregar
    const permissions = [
        '<uses-permission android:name="android.permission.CAMERA" />',
        '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />',
        '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />'
    ];
    
    // Agregar permisos si no existen
    permissions.forEach(permission => {
        if (!manifest.includes(permission)) {
            // Encontrar la última uses-permission o el lugar para insertarla
            const lastPermissionMatch = manifest.lastIndexOf('</uses-permission>');
            if (lastPermissionMatch !== -1) {
                const insertPoint = lastPermissionMatch + '</uses-permission>'.length;
                manifest = manifest.substring(0, insertPoint) + '\n    ' + permission + manifest.substring(insertPoint);
            } else if (manifest.includes('<uses-permission')) {
                // Encontrar la primera uses-permission y agregar después
                const firstPermissionMatch = manifest.indexOf('</uses-permission>');
                if (firstPermissionMatch !== -1) {
                    const insertPoint = firstPermissionMatch + '</uses-permission>'.length;
                    manifest = manifest.substring(0, insertPoint) + '\n    ' + permission + manifest.substring(insertPoint);
                }
            } else {
                // Si no hay permisos, agregar antes de <application>
                const appIndex = manifest.indexOf('<application');
                if (appIndex !== -1) {
                    manifest = manifest.substring(0, appIndex) + '    ' + permission + '\n    ' + manifest.substring(appIndex);
                }
            }
        }
    });
    
    fs.writeFileSync(manifestPath, manifest, 'utf-8');
    console.log('Permisos de cámara agregados al AndroidManifest.xml');
};
