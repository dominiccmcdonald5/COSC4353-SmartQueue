import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styling/PassPurchasePage.css';

interface PassPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  recommended?: boolean;
}

const PassPurchasePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [processing, setProcessing] = useState(false);

  // Get plan data from navigation state
  const { selectedPlan, planType } = location.state || {};

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
    if (!selectedPlan) return;

    setProcessing(true);

    try {
      // TODO: Replace with actual payment processing API call
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate back to home with success message
      navigate('/home', { 
        state: { 
          message: `${selectedPlan.name} purchased successfully! You now have priority access to queues.` 
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
                {selectedPlan.features.map((feature, index) => (
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
                disabled={processing}
              >
                {processing ? 'Processing...' : `Purchase ${selectedPlan.name} - $${selectedPlan.price}`}
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