import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PassPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  recommended?: boolean;
}

const PurchasePassPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const passPlan: PassPlan[] = [
    {
      id: 'silver',
      name: 'Silver Pass',
      price: 29.99,
      duration: '3 months',
      features: [
        'Skip up to 50% of the queue',
        'Early access to select concerts',
        'Email notifications for new events',
        'Basic customer support',
      ],
    },
    {
      id: 'gold',
      name: 'Gold Pass',
      price: 49.99,
      duration: '6 months',
      recommended: true,
      features: [
        'Skip up to 80% of the queue',
        'Priority access to all concerts',
        'Exclusive presale opportunities',
        'SMS and email notifications',
        'Premium customer support',
        'Refund protection on cancelled events',
      ],
    },
    {
      id: 'platinum',
      name: 'Platinum Pass',
      price: 99.99,
      duration: '12 months',
      features: [
        'Skip directly to front 10% of queue',
        'VIP early access (1 hour before general queue)',
        'Exclusive access to premium seats',
        'Personal concert recommendations',
        'Priority customer support',
        'Full refund protection',
        'Complimentary seat upgrades when available',
        'Access to exclusive member events',
      ],
    },
  ];

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setProcessing(true);

    try {
      // TODO: Replace with actual payment processing API call
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate back to home with success message
      navigate('/home', { 
        state: { 
          message: 'Premium pass purchased successfully! You now have priority access to queues.' 
        }
      });
    } catch (error) {
      console.error('Purchase failed:', error);
      // Handle purchase failure
    } finally {
      setProcessing(false);
    }
  };

  const getSelectedPlan = () => {
    return passPlan.find(plan => plan.id === selectedPlan);
  };

  return (
    <div className="purchase-pass-page">
      <header className="pass-header">
        <Link to="/home" className="back-link">← Back to Home</Link>
        <h1>Premium Passes</h1>
      </header>

      <main className="pass-main">
        <section className="hero-section">
          <h2>Skip the Queue with Premium Passes</h2>
          <p>Get priority access to the hottest concerts and never wait in long queues again!</p>
        </section>

        <section className="benefits-section">
          <h3>Why Get a Premium Pass?</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">⚡</div>
              <h4>Skip the Wait</h4>
              <p>Jump ahead in queues and get to ticket selection faster</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🎫</div>
              <h4>Early Access</h4>
              <p>Get first access to tickets before general public</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">⭐</div>
              <h4>Premium Support</h4>
              <p>Get dedicated customer support when you need it</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🔔</div>
              <h4>Priority Notifications</h4>
              <p>Be the first to know about new concerts and presales</p>
            </div>
          </div>
        </section>

        <section className="plans-section">
          <h3>Choose Your Pass</h3>
          <div className="plans-grid">
            {passPlan.map((plan) => (
              <div 
                key={plan.id} 
                className={`plan-card ${plan.recommended ? 'recommended' : ''} ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                {plan.recommended && (
                  <div className="recommended-badge">Most Popular</div>
                )}
                
                <div className="plan-header">
                  <h4>{plan.name}</h4>
                  <div className="plan-price">
                    <span className="price">${plan.price}</span>
                    <span className="duration">/{plan.duration}</span>
                  </div>
                </div>

                <div className="plan-features">
                  <ul>
                    {plan.features.map((feature, index) => (
                      <li key={index}>
                        <span className="checkmark">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  className={`select-plan-btn ${selectedPlan === plan.id ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.id);
                  }}
                >
                  {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedPlan && (
          <section className="checkout-section">
            <div className="checkout-container">
              <div className="checkout-summary">
                <h3>Order Summary</h3>
                <div className="user-info">
                  <p>Account: {user?.name} ({user?.email})</p>
                </div>
                <div className="selected-plan-info">
                  <h4>{getSelectedPlan()?.name}</h4>
                  <p>{getSelectedPlan()?.duration} access</p>
                  <div className="total-price">
                    <span>Total: ${getSelectedPlan()?.price}</span>
                  </div>
                </div>
              </div>

              <div className="checkout-actions">
                <button 
                  onClick={handlePurchase}
                  disabled={processing}
                  className="purchase-btn"
                >
                  {processing ? 'Processing...' : `Purchase ${getSelectedPlan()?.name}`}
                </button>
                <p className="terms">
                  By purchasing, you agree to our terms and conditions. 
                  Pass benefits apply immediately after purchase.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="faq-section">
          <h3>Frequently Asked Questions</h3>
          <div className="faq-list">
            <div className="faq-item">
              <h4>How does queue skipping work?</h4>
              <p>Premium pass holders are automatically moved ahead in the queue based on their pass level. You'll see your improved position immediately when joining a queue.</p>
            </div>
            <div className="faq-item">
              <h4>When do my benefits start?</h4>
              <p>Your premium pass benefits are active immediately after purchase and will appear on your next queue join.</p>
            </div>
            <div className="faq-item">
              <h4>Can I upgrade my pass later?</h4>
              <p>Yes! You can upgrade to a higher tier at any time. The difference in price will be prorated based on your remaining time.</p>
            </div>
            <div className="faq-item">
              <h4>What happens if a concert is cancelled?</h4>
              <p>Gold and Platinum pass holders receive full refund protection for cancelled events, while Silver pass holders receive partial refunds.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PurchasePassPage;