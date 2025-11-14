// tests/setup.js
// Configuración global para todas las pruebas

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 👈 Importar jest explícitamente en ESM
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno de prueba
dotenv.config({ path: join(__dirname, '..', '.env.test') });

// Mock de console para reducir ruido en tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Timeout global para tests
jest.setTimeout(10000);
