import fs from 'fs';
import path from 'path';

export const cleanSessionFiles = (authPath: string) => {
    if (!fs.existsSync(authPath)) return;
    const files = fs.readdirSync(authPath);
    files.forEach(file => {
        // MANTENER creds.json (fundamental para no desloguear)
        // Borrar el resto de basura temporal
        if (file !== 'creds.json' && (file.startsWith('pre-key') || file.startsWith('app-state'))) {
            try {
                fs.unlinkSync(path.join(authPath, file));
            } catch (err) {
                // Silencioso si el archivo está en uso
            }
        }
    });
    console.log("🧹 Limpieza de sesión completada.");
};