export const BCRYPT_COST = 12;

// Precomputed via bcrypt.hashSync('insula-timing-safe-dummy-password', 12).
// Used when no user/record is found, so bcrypt.compare always runs against a
// real hash — the response time doesn't reveal whether the email exists.
export const DUMMY_PASSWORD_HASH = '$2b$12$hjfRqOggiwQ5OIRZxzQCO.KnRiAdaJPvoX1P6niQOVh8f3kChT6jW';
