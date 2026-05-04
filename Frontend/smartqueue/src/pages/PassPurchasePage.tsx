import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styling/PassPurchasePage.css';
import { chargeForPassSelection } from '../utils/passPricing';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');

interface CheckoutPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  chargePrice?: number;
}

const PassPurchasePage: React.FC = () => {
  const { user, updateMembership } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [processing, setProcessing] = useState(false);

  // Get plan data from navigation state
  const { selectedPlan } = (location.state || {}) as { selectedPlan?: CheckoutPlan };

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
  const [errors, setErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});

  const amountCharged = useMemo(() => {
    if (!selectedPlan) return 0;
    if (typeof selectedPlan.chargePrice === 'number' && Number.isFinite(selectedPlan.chargePrice)) {
      return selectedPlan.chargePrice;
    }
    return chargeForPassSelection(selectedPlan.id as 'gold' | 'silver', user?.passStatus ?? 'None');
  }, [selectedPlan, user?.passStatus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let filteredValue = value;

    if (name === 'cardNumber') {
      const digits = value.replace(/\D/g, '').slice(0, 16);
      filteredValue = digits.replace(/(.{4})/g, '$1 ').trim();
    } else if (name === 'expiryDate') {
      const digits = value.replace(/\D/g, '').slice(0, 4);
      filteredValue = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    } else if (name === 'cvv') {
      filteredValue = value.replace(/\D/g, '').slice(0, 4);
    } else if (name === 'nameOnCard') {
      filteredValue = value.replace(/[^a-zA-Z\s'-]/g, '');
    } else if (name === 'city') {
      filteredValue = value.replace(/[^a-zA-Z\s'-]/g, '');
    } else if (name === 'zipCode') {
      filteredValue = value.replace(/\D/g, '').slice(0, 5);
    } else if (name === 'billingAddress') {
      filteredValue = value.replace(/[^a-zA-Z0-9\s#.,-]/g, '');
    }

    setFormData(prev => ({
      ...prev,
      [name]: filteredValue
    }));

    if (errors[name as keyof typeof formData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !user?.id || isSamePass) return;

    const newErrors: Partial<Record<keyof typeof formData, string>> = {};
    const cardDigits = formData.cardNumber.replace(/\s/g, '');
    const expParts = formData.expiryDate.split('/');
    const expMonth = Number(expParts[0]);
    const expYear = Number(`20${expParts[1]}`);

    if (cardDigits.length !== 16) {
      newErrors.cardNumber = 'Card number must be exactly 16 digits';
    }

    if (
      expParts.length !== 2 ||
      expParts[0].length !== 2 ||
      expParts[1].length !== 2 ||
      expMonth < 1 ||
      expMonth > 12
    ) {
      newErrors.expiryDate = 'Enter a valid expiry date (MM/YY)';
    } else {
      const now = new Date();
      const expDate = new Date(expYear, expMonth, 1);
      if (expDate <= now) {
        newErrors.expiryDate = 'Card has expired';
      }
    }

    if (formData.cvv.length < 3) {
      newErrors.cvv = 'CVV must be 3 or 4 digits';
    }

    if (formData.nameOnCard.trim().length < 2) {
      newErrors.nameOnCard = 'Name on card must be at least 2 characters';
    }

    if (formData.billingAddress.trim().length < 5) {
      newErrors.billingAddress = 'Enter a valid billing address';
    }

    if (formData.city.trim().length < 2) {
      newErrors.city = 'Enter a valid city';
    }

    if (formData.zipCode.length !== 5) {
      newErrors.zipCode = 'ZIP code must be exactly 5 digits';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setProcessing(true);
    console.log(selectedPlan);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Capitalize the pass status for consistency
      const capitalizedPassStatus = selectedPlan.id.charAt(0).toUpperCase() + selectedPlan.id.slice(1) as 'Gold' | 'Silver' | 'None';

      if (user?.passStatus === 'Gold' && capitalizedPassStatus === 'Silver') {
        alert('You cannot downgrade from Gold to Silver.');
        setProcessing(false);
        return;
      }
      
      // Call API to update user's pass status
      const response = await fetch(`${API_BASE}/api/user/pass/update`, {
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
                <span className="total-amount">${amountCharged.toFixed(2)}</span>
                {user?.passStatus === 'Silver' && selectedPlan.id === 'gold' && (
                  <p className="upgrade-price-note">Silver → Gold: you pay the difference (Gold − Silver).</p>
                )}
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
                  maxLength={19}
                  inputMode="numeric"
                  required
                />
                {errors.cardNumber && <span className="error-message">{errors.cardNumber}</span>}
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
                    maxLength={5}
                    inputMode="numeric"
                    required
                  />
                  {errors.expiryDate && <span className="error-message">{errors.expiryDate}</span>}
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
                    maxLength={4}
                    inputMode="numeric"
                    required
                  />
                  {errors.cvv && <span className="error-message">{errors.cvv}</span>}
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
                {errors.nameOnCard && <span className="error-message">{errors.nameOnCard}</span>}
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
                {errors.billingAddress && <span className="error-message">{errors.billingAddress}</span>}
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
                  {errors.city && <span className="error-message">{errors.city}</span>}
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
                    maxLength={5}
                    inputMode="numeric"
                    required
                  />
                  {errors.zipCode && <span className="error-message">{errors.zipCode}</span>}
                </div>
              </div>

              <button
                type="submit"
                className="purchase-button"
                disabled={processing || isSamePass}
                title={isSamePass ? 'You already have this pass' : ''}
              >
                {processing
                  ? 'Processing...'
                  : isSamePass
                    ? `You already have ${selectedPlan.name}`
                    : `Purchase ${selectedPlan.name} - $${amountCharged.toFixed(2)}`}
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