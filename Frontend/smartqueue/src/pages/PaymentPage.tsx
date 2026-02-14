import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  const [errors, setErrors] = useState<Partial<PaymentForm>>({});

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
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setPaymentForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof PaymentForm] as any,
          [child]: value,
        },
      }));
    } else {
      setPaymentForm(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name as keyof PaymentForm]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<PaymentForm> = {};

    if (!paymentForm.cardNumber || paymentForm.cardNumber.length < 16) {
      newErrors.cardNumber = 'Valid card number is required';
    }
    if (!paymentForm.expiryDate || !/^\d{2}\/\d{2}$/.test(paymentForm.expiryDate)) {
      newErrors.expiryDate = 'Valid expiry date is required (MM/YY)';
    }
    if (!paymentForm.cvv || paymentForm.cvv.length < 3) {
      newErrors.cvv = 'Valid CVV is required';
    }
    if (!paymentForm.cardholderName) {
      newErrors.cardholderName = 'Cardholder name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setProcessing(true);

    try {
      // TODO: Replace with actual payment processing API call
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Clear selected seats from storage
      sessionStorage.removeItem('selectedSeats');
      
      // Navigate to success page or home
      navigate('/home', { 
        state: { 
          message: 'Payment successful! Your tickets have been confirmed.' 
        }
      });
    } catch (error) {
      console.error('Payment failed:', error);
      // Handle payment failure
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
                  <span>{seat.section} {seat.row}{seat.seatNumber}</span>
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
                    required
                  />
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
                    maxLength={2}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="billingAddress.zipCode">ZIP Code</label>
                  <input
                    type="text"
                    id="billingAddress.zipCode"
                    name="billingAddress.zipCode"
                    value={paymentForm.billingAddress.zipCode}
                    onChange={handleInputChange}
                    placeholder="10001"
                    maxLength={10}
                    required
                  />
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
  );
};

export default PaymentPage;