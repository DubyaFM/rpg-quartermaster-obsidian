#!/usr/bin/env node
/**
 * Deploy Quartermaster Plugin to Test Vault
 * Auto-detects Windows vs WSL environment and deploys to the correct location
 *
 * Usage:
 *   npm run deploy          # Auto-detect environment
 *   npm run deploy:win      # Force Windows path
 *   npm run deploy:wsl      # Force WSL path
 *
 * Auto-detected Paths:
 *   Windows:  C:/Dev/testing-vault/
 *   WSL:      ~/projects/test-vault/
 *
 * You can override by setting TEST_VAULT_PATH environment variable:
 *   export TEST_VAULT_PATH="$HOME/projects/test-vault"  # Linux/Mac/WSL
 *   set TEST_VAULT_PATH=C:\Dev\testing-vault            # Windows CMD
 *   $env:TEST_VAULT_PATH="C:\Dev\testing-vault"         # Windows PowerShell
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// Get current directory (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect if running in WSL (Windows Subsystem for Linux)
 */
function isWSL() {
  if (process.platform !== 'linux') return false;

  try {
    const procVersion = readFileSync('/proc/version', 'utf8').toLowerCase();
    return procVersion.includes('microsoft') || procVersion.includes('wsl');
  } catch {
    return false;
  }
}

/**
 * Get the test vault path based on environment
 * Priority:
 *   1. TEST_VAULT_PATH environment variable (if set)
 *   2. Auto-detect Windows vs WSL
 */
function getTestVaultPath() {
  // Check for environment variable override
  if (process.env.TEST_VAULT_PATH) {
    return process.env.TEST_VAULT_PATH;
  }

  // Auto-detect environment
  if (isWSL()) {
    // WSL environment - expand ~ to home directory
    const wslPath = '~/projects/test-vault';
    return wslPath.replace('~', homedir());
  } else if (process.platform === 'win32') {
    // Windows environment
    return 'C:/Dev/testing-vault';
  } else {
    // Linux/Mac fallback
    return join(homedir(), 'projects/test-vault');
  }
}

// Configuration
const SOURCE_DIR = join(__dirname, '..', 'dist');
const TEST_VAULT_PATH = getTestVaultPath();

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  log(`ERROR: ${message}`, colors.red);
}

function logSuccess(message) {
  log(message, colors.green);
}

function logInfo(message) {
  log(message, colors.cyan);
}

function logWarning(message) {
  log(message, colors.yellow);
}

// Main deployment logic
function deploy() {
  log('======================================', colors.blue);
  log('Deploying Quartermaster to Test Vault', colors.blue);
  log('======================================', colors.blue);
  console.log();

  // Detect and show environment
  const envType = isWSL() ? 'WSL' : (process.platform === 'win32' ? 'Windows' : 'Linux/Mac');
  const isOverride = process.env.TEST_VAULT_PATH ? true : false;

  if (isOverride) {
    logInfo(`Environment: ${envType} (using TEST_VAULT_PATH override)`);
  } else {
    logInfo(`Environment: ${envType} (auto-detected)`);
  }

  const DEST_DIR = join(TEST_VAULT_PATH, '.obsidian', 'plugins', 'quartermaster');

  logInfo(`Source: ${SOURCE_DIR}`);
  logInfo(`Destination: ${DEST_DIR}`);
  console.log();

  // 2. Check if dist folder exists
  if (!existsSync(SOURCE_DIR)) {
    logError('dist folder not found!');
    log('Please run "npm run build" first.', colors.yellow);
    console.log();
    process.exit(1);
  }

  // 3. Create destination directories
  logInfo('Creating directories...');
  try {
    mkdirSync(DEST_DIR, { recursive: true });
    mkdirSync(join(DEST_DIR, 'config'), { recursive: true });
    mkdirSync(join(DEST_DIR, 'config', 'templates'), { recursive: true });
    logSuccess('✓ Directories created');
  } catch (error) {
    logError(`Failed to create directories: ${error.message}`);
    process.exit(1);
  }

  console.log();

  // 4. Copy main plugin files
  logInfo('Copying plugin files...');
  const mainFiles = ['main.js', 'manifest.json', 'styles.css'];
  let copiedCount = 0;

  for (const file of mainFiles) {
    const sourcePath = join(SOURCE_DIR, file);
    const destPath = join(DEST_DIR, file);

    if (existsSync(sourcePath)) {
      try {
        copyFileSync(sourcePath, destPath);
        logSuccess(`✓ ${file}`);
        copiedCount++;
      } catch (error) {
        logError(`Failed to copy ${file}: ${error.message}`);
      }
    } else {
      logWarning(`✗ ${file} not found in dist`);
    }
  }

  console.log();

  // 5. Copy config files (*.yaml)
  logInfo('Copying config files...');
  const configSourceDir = join(SOURCE_DIR, 'config');
  const configDestDir = join(DEST_DIR, 'config');

  if (existsSync(configSourceDir)) {
    try {
      const configFiles = readdirSync(configSourceDir).filter(file => file.endsWith('.yaml'));

      if (configFiles.length > 0) {
        for (const file of configFiles) {
          copyFileSync(join(configSourceDir, file), join(configDestDir, file));
          logSuccess(`✓ config/${file}`);
        }
      } else {
        logWarning('No base config files found to copy.');
      }
    } catch (error) {
      logError(`Failed to copy config files: ${error.message}`);
    }
  } else {
    logWarning('Config directory not found in dist.');
  }

  console.log();

  // 6. Copy templates (*.yaml)
  logInfo('Copying templates directory...');
  const templatesSourceDir = join(SOURCE_DIR, 'config', 'templates');
  const templatesDestDir = join(DEST_DIR, 'config', 'templates');

  if (existsSync(templatesSourceDir)) {
    try {
      const templateFiles = readdirSync(templatesSourceDir).filter(file => file.endsWith('.yaml'));

      if (templateFiles.length > 0) {
        for (const file of templateFiles) {
          copyFileSync(join(templatesSourceDir, file), join(templatesDestDir, file));
          logSuccess(`✓ config/templates/${file}`);
        }
      } else {
        logWarning('No custom templates found - folder left empty.');
      }
    } catch (error) {
      logError(`Failed to copy template files: ${error.message}`);
    }
  } else {
    logWarning('Templates directory not found in dist.');
  }

  console.log();
  log('======================================', colors.green);
  log('Deployment complete!', colors.green);
  log('======================================', colors.green);
  console.log();
  logInfo('Next steps:');
  log('1. Open Obsidian');
  log('2. Go to Settings > Community Plugins');
  log('3. Reload the plugin or restart Obsidian');
  console.log();
}

// Run deployment
deploy();
