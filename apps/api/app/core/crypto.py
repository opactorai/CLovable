import base64
import os
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import secrets


class SecretBox:
    def __init__(self, key: Optional[str] = None) -> None:
        # Expect a base64 urlsafe key. If none provided, derive from env or generate (dev only)
        key = key or os.getenv("ENCRYPTION_KEY")
        if key is None:
            # Dev fallback: generate ephemeral key
            key = base64.urlsafe_b64encode(os.urandom(32)).decode()
        self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        token = self._fernet.encrypt(plaintext.encode("utf-8"))
        return token.decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")


secret_box = SecretBox()


class AESGCMBox:
    """AES-256-GCM encryption box using a 32-byte key from env AES_KEY.

    The ciphertext is returned as urlsafe base64 of nonce || ciphertext || tag (combined by AESGCM).
    """

    def __init__(self, key: Optional[bytes] = None) -> None:
        key_b64 = os.getenv("AES_KEY")
        if key is None:
            if key_b64:
                try:
                    key = base64.urlsafe_b64decode(key_b64)
                except Exception:
                    key = None
        if key is None:
            # Dev fallback: generate ephemeral key (not for production!)
            key = os.urandom(32)
        if len(key) != 32:
            # Normalize/derive length 32 deterministically is out of scope; enforce 32.
            # For production supply a valid 32-byte key via AES_KEY (urlsafe base64).
            key = key[:32].ljust(32, b"\0")
        self._key = key
        self._aesgcm = AESGCM(self._key)

    def encrypt(self, plaintext: str) -> str:
        nonce = secrets.token_bytes(12)
        data = plaintext.encode("utf-8")
        ct = self._aesgcm.encrypt(nonce, data, None)
        blob = nonce + ct
        return base64.urlsafe_b64encode(blob).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        blob = base64.urlsafe_b64decode(ciphertext)
        nonce, ct = blob[:12], blob[12:]
        pt = self._aesgcm.decrypt(nonce, ct, None)
        return pt.decode("utf-8")


aesgcm_box = AESGCMBox()
