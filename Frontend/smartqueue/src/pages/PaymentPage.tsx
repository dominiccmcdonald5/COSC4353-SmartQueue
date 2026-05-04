import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styling/PaymentPage.css';

interface SelectedSeat {
  id: string;
  section: string;
  row: string;
  seatNumber: string;
  price: number;
}

interface PaymentForm {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

const PaymentPage: React.FC = () => {
  const { concertId } = useParams<{ concertId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
  });
  const [processing, setProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState<Partial<PaymentForm> & { billingAddress?: Partial<PaymentForm['billingAddress']> }>({});

  useEffect(() => {
    // Get selected seats from session storage
    const storedSeats = sessionStorage.getItem('selectedSeats');
    if (storedSeats) {
      setSelectedSeats(JSON.parse(storedSeats));
    } else {
      // Redirect back if no seats selected
      navigate(`/seating/${concertId}`);
    }
  }, [concertId, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let filteredValue = value;

    if (name === 'cardNumber') {
      // Digits only, formatted as groups of 4 separated by spaces, max 16 digits
      const digits = value.replace(/\D/g, '').slice(0, 16);
      filteredValue = digits.replace(/(.{4})/g, '$1 ').trim();
    } else if (name === 'expiryDate') {
      // Digits only, auto-insert slash after MM, format MM/YY
      const digits = value.replace(/\D/g, '').slice(0, 4);
      filteredValue = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    } else if (name === 'cvv') {
      // Digits only, max 4
      filteredValue = value.replace(/\D/g, '').slice(0, 4);
    } else if (name === 'cardholderName') {
      filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (name === 'billingAddress.city') {
      filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (name === 'billingAddress.state') {
      // Letters only, max 2 characters (standard US state abbreviation)
      filteredValue = value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    } else if (name === 'billingAddress.zipCode') {
      // Digits only, max 5 (standard US ZIP)
      filteredValue = value.replace(/\D/g, '').slice(0, 5);
    }

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setPaymentForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof PaymentForm] as any,
          [child]: filteredValue,
        },
      }));
    } else {
      setPaymentForm(prev => ({
        ...prev,
        [name]: filteredValue,
      }));
    }
    
    // Clear error when user starts typing
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      if (parent === 'billingAddress' && errors.billingAddress?.[child as keyof PaymentForm['billingAddress']]) {
        setErrors(prev => ({
          ...prev,
          billingAddress: prev.billingAddress ? { ...prev.billingAddress, [child]: undefined } : undefined,
        }));
      }
    } else if (errors[name as keyof PaymentForm]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate card fields before processing
    const newErrors: typeof errors = {};
    const rawDigits = paymentForm.cardNumber.replace(/\s/g, '');
    if (rawDigits.length !== 16) {
      newErrors.cardNumber = 'Card number must be exactly 16 digits';
    }
    const expParts = paymentForm.expiryDate.split('/');
    const expMonth = Number(expParts[0]);
    const expYear = Number(`20${expParts[1]}`);
    if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2 ||
        expMonth < 1 || expMonth > 12) {
      newErrors.expiryDate = 'Enter a valid expiry date (MM/YY)';
    } else {
      const now = new Date();
      const expDate = new Date(expYear, expMonth - 1 + 1, 1); // first day of month after expiry
      if (expDate <= now) {
        newErrors.expiryDate = 'Card has expired';
      }
    }
    if (paymentForm.cvv.length < 3) {
      newErrors.cvv = 'CVV must be 3 or 4 digits';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setProcessing(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const userID = Number(user?.id);
      const concertID = Number(concertId);
      if (!Number.isInteger(userID) || userID <= 0 || !Number.isInteger(concertID) || concertID <= 0) {
        throw new Error('Missing user or concert information for payment confirmation');
      }

      const paymentResponse = await fetch('https://cosc4353-smartqueue.onrender.com/api/payment/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userID,
          concertId: concertID,
          ticketCount: selectedSeats.length,
          totalCost: getGrandTotal(),
        }),
      });

      const paymentPayload = await paymentResponse.json();
      if (!paymentResponse.ok || !paymentPayload.success) {
        throw new Error(paymentPayload.message || 'Failed to finalize payment status');
      }
      
      // Clear selected seats from storage
      sessionStorage.removeItem('selectedSeats');
      
      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Payment failed:', error);
      window.alert(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getTotalPrice = () => {
    return selectedSeats.reduce((total, seat) => total + seat.price, 0);
  };

  const getFees = () => {
    const subtotal = getTotalPrice();
    return {
      serviceFee: subtotal * 0.1, // 10% service fee
      processingFee: 2.99, // Fixed processing fee
    };
  };

  const getGrandTotal = () => {
    const subtotal = getTotalPrice();
    const fees = getFees();
    return subtotal + fees.serviceFee + fees.processingFee;
  };

  return (
    <div className="payment-page">
      <div className="payment-inner">
        <header className="payment-header">
          <Link to={`/seating/${concertId}`} className="back-link">← Back to Seating</Link>
          <h1>Payment</h1>
        </header>

        <main className="payment-main">
        <div className="payment-container">
          <div className="order-summary">
            <h2>Order Summary</h2>
            
            <div className="concert-info">
              <h3>Summer Music Festival</h3>
              <p>Various Artists • Central Park • July 15, 2026</p>
            </div>

            <div className="selected-seats">
              <h4>Selected Seats ({selectedSeats.length})</h4>
              {selectedSeats.map((seat) => (
                <div key={seat.id} className="seat-item">
                  <span>Seat {seat.row}{seat.seatNumber}</span>
                  <span>${seat.price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pricing-breakdown">
              <div className="price-row">
                <span>Subtotal:</span>
                <span>${getTotalPrice().toFixed(2)}</span>
              </div>
              <div className="price-row">
                <span>Service Fee:</span>
                <span>${getFees().serviceFee.toFixed(2)}</span>
              </div>
              <div className="price-row">
                <span>Processing Fee:</span>
                <span>${getFees().processingFee.toFixed(2)}</span>
              </div>
              <div className="price-row total">
                <span>Total:</span>
                <span>${getGrandTotal().toFixed(2)}</span>
              </div>
            </div>
            <p className="refund-note">All ticket sales are final. Not refundable.</p>
          </div>

          <div className="payment-form">
            <h2>Payment Information</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="cardNumber">Card Number</label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  value={paymentForm.cardNumber}
                  onChange={handleInputChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  inputMode="numeric"
                  required
                />
                {errors.cardNumber && <span className="error">{errors.cardNumber}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="expiryDate">Expiry Date</label>
                  <input
                    type="text"
                    id="expiryDate"
                    name="expiryDate"
                    value={paymentForm.expiryDate}
                    onChange={handleInputChange}
                    placeholder="MM/YY"
                    maxLength={5}
                    inputMode="numeric"
                    required
                  />
                  {errors.expiryDate && <span className="error">{errors.expiryDate}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="cvv">CVV</label>
                  <input
                    type="text"
                    id="cvv"
                    name="cvv"
                    value={paymentForm.cvv}
                    onChange={handleInputChange}
                    placeholder="123"
                    maxLength={4}
                    inputMode="numeric"
                    required
                  />
                  {errors.cvv && <span className="error">{errors.cvv}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="cardholderName">Cardholder Name</label>
                <input
                  type="text"
                  id="cardholderName"
                  name="cardholderName"
                  value={paymentForm.cardholderName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  pattern="[A-Za-z\s]+"
                  title="Letters and spaces only"
                  required
                />
                {errors.cardholderName && <span className="error">{errors.cardholderName}</span>}
              </div>

              <h3>Billing Address</h3>
              
              <div className="form-group">
                <label htmlFor="billingAddress.street">Street Address</label>
                <input
                  type="text"
                  id="billingAddress.street"
                  name="billingAddress.street"
                  value={paymentForm.billingAddress.street}
                  onChange={handleInputChange}
                  placeholder="123 Main Street"
                  required
                />
                {errors.billingAddress?.street && <span className="error">{errors.billingAddress.street}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="billingAddress.city">City</label>
                  <input
                    type="text"
                    id="billingAddress.city"
                    name="billingAddress.city"
                    value={paymentForm.billingAddress.city}
                    onChange={handleInputChange}
                    placeholder="New York"
                    pattern="[A-Za-z\s]+"
                    title="Letters and spaces only"
                    required
                  />
                  {errors.billingAddress?.city && <span className="error">{errors.billingAddress.city}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="billingAddress.state">State</label>
                  <input
                    type="text"
                    id="billingAddress.state"
                    name="billingAddress.state"
                    value={paymentForm.billingAddress.state}
                    onChange={handleInputChange}
                    placeholder="NY"
                    pattern="[A-Za-z]{2}"
                    title="2-letter state abbreviation (e.g. TX)"
                    maxLength={2}
                    required
                  />
                  {errors.billingAddress?.state && <span className="error">{errors.billingAddress.state}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="billingAddress.zipCode">ZIP Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="billingAddress.zipCode"
                    name="billingAddress.zipCode"
                    value={paymentForm.billingAddress.zipCode}
                    onChange={handleInputChange}
                    placeholder="10001"
                    pattern="[0-9]{5}"
                    title="5-digit ZIP code"
                    maxLength={5}
                    required
                  />
                  {errors.billingAddress?.zipCode && <span className="error">{errors.billingAddress.zipCode}</span>}
                </div>
              </div>

              <button 
                type="submit" 
                className="pay-button"
                disabled={processing}
              >
                {processing ? 'Processing...' : `Pay $${getGrandTotal().toFixed(2)}`}
              </button>
            </form>
          </div>
        </div>

        <div className="security-notice">
          <p>🔒 Your payment information is secure and encrypted</p>
        </div>
      </main>
      </div>

      {showSuccessModal && (
        <div className="payment-success-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="payment-success-modal" onClick={e => e.stopPropagation()}>
            <div className="payment-success-icon">✓</div>
            <h2>Payment Successful 🎉</h2>
            <p>Congrats on securing your seats!</p>
            <div className="payment-success-actions">
              <button
                type="button"
                className="payment-success-btn primary"
                onClick={() => navigate('/dashboard')}
              >
                View in Dashboard
              </button>
              <button
                type="button"
                className="payment-success-btn secondary"
                onClick={() => navigate('/home')}
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPage;