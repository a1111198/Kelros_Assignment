/**
 * WebAuthn + Web Crypto API utilities for biometric-based encryption
 * 
 * SECURITY MODEL:
 * This implementation uses WebAuthn's PRF (Pseudo Random Function) extension
 * when available. PRF provides deterministic secret output that can only be
 * obtained through successful biometric authentication.
 * 
 * Fallback: If PRF is not available, we use a simpler model where WebAuthn
 * acts as a gate, and a user-provided PIN adds the secret component.
 * 
 * The salt/move data is encrypted with AES-256-GCM.
 */

const CREDENTIAL_STORAGE_KEY = 'rpsls_webauthn_credential';
const ENCRYPTED_KEY_STORAGE = 'rpsls_encrypted_master_key';
const PRF_SUPPORTED_KEY = 'rpsls_prf_supported';

/**
 * Check if WebAuthn is supported in the browser
 */
export const isWebAuthnSupported = () => {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    navigator.credentials.create &&
    navigator.credentials.get
  );
};

/**
 * Check if platform authenticator (biometric) is available
 */
export const isPlatformAuthenticatorAvailable = async () => {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    console.error('Error checking platform authenticator:', e);
    return false;
  }
};

/**
 * Check if PRF extension is likely supported by the browser
 * This checks browser capabilities before registration
 * Note: Actual support can only be confirmed during credential creation
 */
export const checkPrfCapability = async () => {
  if (!isWebAuthnSupported()) return false;
  
  // Check if the browser has the PRF extension in PublicKeyCredential
  // This is a heuristic - actual support depends on the authenticator
  try {
    // Chrome 116+ and some other browsers support PRF
    // We can check if the browser understands the prf extension
    const isChrome = /Chrome\/(\d+)/.exec(navigator.userAgent);
    if (isChrome) {
      const version = parseInt(isChrome[1], 10);
      if (version >= 116) {
        // Chrome 116+ has PRF support, but it depends on the platform
        // macOS with Touch ID, Windows with Windows Hello generally work
        return true;
      }
    }
    
    // Safari 17+ has some PRF support
    const isSafari = /Version\/(\d+)/.exec(navigator.userAgent);
    if (isSafari && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
      const version = parseInt(isSafari[1], 10);
      if (version >= 17) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    console.error('Error checking PRF capability:', e);
    return false;
  }
};

/**
 * Generate a random challenge for WebAuthn operations
 */
const generateChallenge = () => {
  return crypto.getRandomValues(new Uint8Array(32));
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Store credential ID for future authentication
 */
const storeCredential = (credentialId, userHandle) => {
  const data = {
    credentialId: arrayBufferToBase64(credentialId),
    userHandle: arrayBufferToBase64(userHandle),
    createdAt: Date.now()
  };
  localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(data));
};

/**
 * Get stored credential ID
 */
export const getStoredCredential = () => {
  try {
    const data = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        credentialId: base64ToArrayBuffer(parsed.credentialId),
        userHandle: base64ToArrayBuffer(parsed.userHandle),
        prfSalt: parsed.prfSalt || null,
        createdAt: parsed.createdAt
      };
    }
  } catch (e) {
    console.error('Failed to get stored credential:', e);
  }
  return null;
};

/**
 * Check if user has registered WebAuthn credential
 */
export const hasRegisteredCredential = () => {
  return getStoredCredential() !== null && localStorage.getItem(ENCRYPTED_KEY_STORAGE) !== null;
};

/**
 * Generate a new AES-256 key for encryption
 */
const generateMasterKey = async () => {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable so we can export/import it
    ['encrypt', 'decrypt']
  );
};

/**
 * Derive a key from password using PBKDF2
 */
const deriveKeyFromPassword = async (password, salt) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt the master key for storage
 */
const encryptMasterKey = async (masterKey, password) => {
  const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const wrappingKey = await deriveKeyFromPassword(password, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    exportedKey
  );
  
  // Store salt + iv + encrypted key
  const result = {
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    encryptedKey: arrayBufferToBase64(encrypted)
  };
  
  return JSON.stringify(result);
};

/**
 * Decrypt the master key from storage
 */
const decryptMasterKey = async (encryptedData, password) => {
  const { salt, iv, encryptedKey } = JSON.parse(encryptedData);
  
  const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));
  const encryptedBuffer = base64ToArrayBuffer(encryptedKey);
  
  const wrappingKey = await deriveKeyFromPassword(password, saltBuffer);
  
  const decryptedKeyData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    wrappingKey,
    encryptedBuffer
  );
  
  return await crypto.subtle.importKey(
    'raw',
    decryptedKeyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Register a new WebAuthn credential using biometrics
 * Attempts to use PRF extension for secure key derivation
 * Falls back to PIN-based encryption if PRF not available
 */
export const registerWebAuthnCredential = async (username = 'RPSLS User', pin = '') => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge();
  const userHandle = crypto.getRandomValues(new Uint8Array(16));
  
  // PRF salt for key derivation (if PRF is supported)
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'RPSLS Game',
      id: window.location.hostname
    },
    user: {
      id: userHandle,
      name: username,
      displayName: username
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred'
    },
    timeout: 60000,
    attestation: 'none',
    // Request PRF extension
    extensions: {
      prf: {
        eval: {
          first: prfSalt
        }
      }
    }
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    // Check if PRF is supported
    const prfSupported = credential.getClientExtensionResults?.()?.prf?.enabled || 
                         credential.getClientExtensionResults?.()?.prf?.results?.first;
    
    localStorage.setItem(PRF_SUPPORTED_KEY, prfSupported ? 'true' : 'false');

    // Store credential ID and PRF salt
    const credentialData = {
      credentialId: arrayBufferToBase64(credential.rawId),
      userHandle: arrayBufferToBase64(userHandle),
      prfSalt: arrayBufferToBase64(prfSalt.buffer),
      createdAt: Date.now()
    };
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credentialData));
    
    // Generate master key
    const masterKey = await generateMasterKey();
    
    // Encrypt master key
    // If PRF supported: use PRF output as password (will be derived during auth)
    // If PRF not supported: use credential ID + user-provided PIN
    let password;
    if (prfSupported && credential.getClientExtensionResults?.()?.prf?.results?.first) {
      // Use PRF output directly for password
      const prfOutput = new Uint8Array(credential.getClientExtensionResults().prf.results.first);
      password = arrayBufferToBase64(prfOutput.buffer);
    } else {
      // Fallback: require PIN from user - this is the secret component
      if (!pin || pin.length < 4) {
        throw new Error('PIN required (minimum 4 characters). Your browser does not support PRF extension for fully biometric-based encryption.');
      }
      // Password = PIN (secret, not stored) + credentialId (links to this credential)
      password = pin + '-' + arrayBufferToBase64(credential.rawId);
    }
    
    const encryptedMasterKey = await encryptMasterKey(masterKey, password);
    localStorage.setItem(ENCRYPTED_KEY_STORAGE, encryptedMasterKey);

    return {
      success: true,
      credentialId: credential.rawId,
      prfSupported
    };
  } catch (error) {
    console.error('WebAuthn registration failed:', error);
    throw new Error(`Biometric registration failed: ${error.message}`);
  }
};

/**
 * Authenticate with WebAuthn and retrieve the encryption key
 * Uses PRF for key material if available, otherwise requires PIN
 */
export const authenticateAndDeriveKey = async (pin = '') => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const storedCredential = getStoredCredential();
  if (!storedCredential) {
    throw new Error('No registered credential found. Please register first.');
  }

  const encryptedKeyData = localStorage.getItem(ENCRYPTED_KEY_STORAGE);
  if (!encryptedKeyData) {
    throw new Error('No encryption key found. Please register biometric again.');
  }

  const prfSupported = localStorage.getItem(PRF_SUPPORTED_KEY) === 'true';
  
  // Get PRF salt if available
  const prfSalt = storedCredential.prfSalt ? 
    new Uint8Array(base64ToArrayBuffer(storedCredential.prfSalt)) : null;

  const challenge = generateChallenge();

  const publicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: [{
      id: storedCredential.credentialId,
      type: 'public-key',
      transports: ['internal']
    }],
    userVerification: 'required',
    timeout: 60000
  };
  
  // Add PRF extension if supported
  if (prfSupported && prfSalt) {
    publicKeyCredentialRequestOptions.extensions = {
      prf: {
        eval: {
          first: prfSalt
        }
      }
    };
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });

    // Derive password based on what's available
    let password;
    
    if (prfSupported && assertion.getClientExtensionResults?.()?.prf?.results?.first) {
      // Use PRF output as password - this is deterministic and tied to biometric
      const prfOutput = new Uint8Array(assertion.getClientExtensionResults().prf.results.first);
      password = arrayBufferToBase64(prfOutput.buffer);
    } else {
      // Fallback: require PIN
      if (!pin || pin.length < 4) {
        throw new Error('PIN required to decrypt. Your browser does not support PRF extension.');
      }
      password = pin + '-' + arrayBufferToBase64(storedCredential.credentialId);
    }
    
    const masterKey = await decryptMasterKey(encryptedKeyData, password);
    return masterKey;
  } catch (error) {
    console.error('WebAuthn authentication failed:', error);
    throw new Error(`Biometric authentication failed: ${error.message}`);
  }
};

/**
 * Check if PRF is supported (biometric-only encryption)
 * If false, PIN will be required
 */
export const isPrfSupported = () => {
  return localStorage.getItem(PRF_SUPPORTED_KEY) === 'true';
};

/**
 * Encrypt data using AES-GCM with the derived key
 */
export const encryptData = async (key, plaintext) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Return IV + ciphertext as base64
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return arrayBufferToBase64(result.buffer);
};

/**
 * Decrypt data using AES-GCM with the derived key
 */
export const decryptData = async (key, encryptedBase64) => {
  const encryptedData = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};

/**
 * Encrypt game data (move + salt) with biometric-derived key
 */
export const encryptGameData = async (key, move, salt) => {
  const data = JSON.stringify({ move, salt: salt.toString() });
  return await encryptData(key, data);
};

/**
 * Decrypt game data with biometric-derived key
 */
export const decryptGameData = async (key, encryptedData) => {
  const decrypted = await decryptData(key, encryptedData);
  return JSON.parse(decrypted);
};

/**
 * Remove stored WebAuthn credential and encryption key
 */
export const removeStoredCredential = () => {
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  localStorage.removeItem(ENCRYPTED_KEY_STORAGE);
  localStorage.removeItem(PRF_SUPPORTED_KEY);
};

