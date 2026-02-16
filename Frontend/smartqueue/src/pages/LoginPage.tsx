import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styling/LoginSignup.css';

const SignUpPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName : '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      await signup(formData.email, formData.password, formData.firstName, formData.lastName);
      navigate('/home');
    } catch (error) {
      setError('Failed to create account. Please try again.');
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">

        {/* Left Column */}
        <div className="signup-left">
          <h1>Join ticketQ</h1>
          <p>Create your account to start queuing for concerts</p>
        </div>

        {/* Right Column */}
        <div className="signup-right">
          <h1>Sign Up</h1>

          <form onSubmit={handleSubmit} className="signup-form">

            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>

          </form>

          <p className="login-link">
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default SignUpPage;
