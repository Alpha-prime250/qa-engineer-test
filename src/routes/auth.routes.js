import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, createUser } from '../db/database.js';
import { JWT_SECRET } from '../config.js';
import { validateEmail, normalizeEmail } from '../utils/validators.js';

const router = express.Router();
// BUG C FIX: email validation now lives in utils/validators.js and requires a TLD
// (the old pattern had no dot/TLD part, so "user@domain" was accepted). Re-exported for tests.
export { validateEmail };

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { password, business_name } = req.body;
    // Normalise so "USER@x.com" and "user@x.com" cannot be registered twice
    const email = normalizeEmail(req.body.email);

    // Validation
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (typeof business_name !== 'string' || business_name.trim().length < 2) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    // Check if user exists
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = createUser({
      email,
      password: hashedPassword,
      business_name,
      type: 'merchant'
    });

    // Generate token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, type: 'merchant' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        email: newUser.email,
        business_name: newUser.business_name
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, type: user.type },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
