import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styling/PassPurchasePage.css';

const PassPurchasePage: React.FC = () => {
  const { user, updateMembership } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [processing, setProcessing] = useState(false);

  // Get plan data from navigation state
  const { selectedPlan } = location.state || {};

  // Check if the selected plan is the same as current pass status
  const isSamePass = selectedPlan && user?.passStatus === (selectedPlan.id.charAt(0).toUpperCase() + selectedPlan.id.slice(1));

  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    nameOnCard: '',
    billingAddress: '',
    city: '',
    zipCode: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !user?.id || isSamePass) return;

    setProcessing(true);
    console.log(selectedPlan);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Capitalize the pass status for consistency
      const capitalizedPassStatus = selectedPlan.id.charAt(0).toUpperCase() + selectedPlan.id.slice(1) as 'Gold' | 'Silver' | 'None';
      
      // Call API to update user's pass status
      const response = await fetch('http://localhost:5000/api/user/pass/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userID: user.id,
          passStatus: capitalizedPassStatus
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update pass status');
      }

      // Update membership in the auth context
      updateMembership(
        capitalizedPassStatus,
        typeof result.passExpiresAt === 'string' ? result.passExpiresAt : null
      );

      // Clear form data after successful purchase
      setFormData({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        nameOnCard: '',
        billingAddress: '',
        city: '',
        zipCode: ''
      });

      // Navigate back to home with success message
      navigate('/home', { 
        state: { 
          message: `${selectedPlan.name} purchased successfully!` 
        }
      });
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!selectedPlan) {
    return (
      <div className="pass-purchase-page">
        <div className="error-container">
          <h2>No Plan Selected</h2>
          <p>Please go back and select a plan to purchase.</p>
          <Link to="/purchase-pass" className="back-link">← Back to Plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pass-purchase-page">
      <main className="purchase-main">
        <section className="header-section">
          <Link to="/purchase-pass" className="back-link">← Back to Plans</Link>
          <h2>Complete Your Purchase</h2>
        </section>

        <div className="purchase-container">
          <div className="order-summary">
            <h3>Order Summary</h3>
            <div className="plan-details">
              <h4>{selectedPlan.name}</h4>
              <p className="plan-duration">{selectedPlan.duration} access</p>
              <ul className="plan-features">
                {selectedPlan.features.map((feature: string, index: number) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <div className="total">
                <span className="total-label">Total: </span>
                <span className="total-amount">${selectedPlan.price}</span>
              </div>
            </div>

            <div className="user-details">
              <h4>Account Information</h4>
              <p>{user?.name} ({user?.email})</p>
            </div>
          </div>

          <div className="payment-form-container">
            <h3>Payment Information</h3>
            <form onSubmit={handlePurchase} className="payment-form">
              <div className="form-group">
                <label htmlFor="cardNumber">Card Number</label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleInputChange}
                  placeholder="1234 5678 9012 3456"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="expiryDate">Expiry Date</label>
                  <input
                    type="text"
                    id="expiryDate"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    placeholder="MM/YY"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cvv">CVV</label>
                  <input
                    type="text"
                    id="cvv"
                    name="cvv"
                    value={formData.cvv}
                    onChange={handleInputChange}
                    placeholder="123"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="nameOnCard">Name on Card</label>
                <input
                  type="text"
                  id="nameOnCard"
                  name="nameOnCard"
                  value={formData.nameOnCard}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="billingAddress">Billing Address</label>
                <input
                  type="text"
                  id="billingAddress"
                  name="billingAddress"
                  value={formData.billingAddress}
                  onChange={handleInputChange}
                  placeholder="123 Main Street"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="city">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="New York"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="zipCode">ZIP Code</label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    placeholder="10001"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="purchase-button"
                disabled={processing || isSamePass}
                title={isSamePass ? 'You already have this pass' : ''}
              >
                {processing ? 'Processing...' : isSamePass ? `You already have ${selectedPlan.name}` : `Purchase ${selectedPlan.name} - $${selectedPlan.price}`}
              </button>

              <p className="terms">
                By clicking "Purchase", you agree to our terms and conditions. 
                Your pass benefits will be active immediately after successful payment.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PassPurchasePage;