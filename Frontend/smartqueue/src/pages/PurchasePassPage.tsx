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
        'Skip the line until 25% venue capacity is filled',
        'Priority queue placement over regular users',
        'Email notifications for new concerts',
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
        'Skip the line until 50% venue capacity is filled',
        'Same priority power as Silver, longer duration',
        'Priority queue placement over regular users',
        'SMS and email notifications',
        'Premium customer support',
        'Refund protection on cancelled events',
      ],
    }
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
      <main className="pass-main">
        <section className="hero-section">
          <Link to="/home" className="back-link">← Back to Home</Link>
          <h2>Purchase Premium Passes</h2>
          <p>Skip the line and get priority access to tickets. Jump ahead of regular users until venue capacity thresholds are reached!</p>
        </section>

        <section className="benefits-section">
          <h3>Why Get a Premium Pass?</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">⚡</div>
              <h4>Skip the Line</h4>
              <p>Jump ahead of regular users until venue capacity thresholds are met</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🎯</div>
              <h4>Guaranteed Access</h4>
              <p>Get priority placement in queue based on your pass level</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">⏰</div>
              <h4>Save Time</h4>
              <p>Spend less time waiting and more time enjoying concerts</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">🔔</div>
              <h4>Priority Notifications</h4>
              <p>Get notified first when new concerts become available</p>
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
              <h4>How does line skipping work?</h4>
              <p>Pass holders skip ahead of regular users until venue capacity thresholds are reached. Silver passes work until 25% capacity, Gold until 50%, and Platinum until 75%.</p>
            </div>
            <div className="faq-item">
              <h4>What's the difference between Silver and Gold?</h4>
              <p>Both Silver and Gold have the same line-skipping power, but Gold lasts longer (6 months vs 3 months) and includes additional perks like refund protection.</p>
            </div>
            <div className="faq-item">
              <h4>When do my benefits start?</h4>
              <p>Your pass benefits are active immediately after purchase and will appear when you join your next concert queue.</p>
            </div>
            <div className="faq-item">
              <h4>What happens when capacity thresholds are reached?</h4>
              <p>Once your pass threshold is hit, you'll be placed in the regular queue with other users. The earlier you join, the better your position will be.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PurchasePassPage;