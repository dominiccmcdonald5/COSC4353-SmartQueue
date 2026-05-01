import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaBolt, FaBullseye, FaClock, FaCheck } from 'react-icons/fa';
import '../styling/PurchasePassPage.css';
import { chargeForPassSelection, GOLD_PASS_PRICE, SILVER_PASS_PRICE } from '../utils/passPricing';

interface PassPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  recommended?: boolean;
}

const ALL_PASS_PLANS: PassPlan[] = [
  {
    id: 'silver',
    name: 'Silver Pass',
    price: 29.99,
    duration: 'year',
    features: ['Skip the line until 25% venue capacity is filled'],
  },
  {
    id: 'gold',
    name: 'Gold Pass',
    price: 49.99,
    duration: 'year',
    recommended: true,
    features: ['Skip the line until 50% venue capacity is filled'],
  },
];

const PurchasePassPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const visiblePlans = useMemo(() => {
    if (!user || user.passStatus === 'None') return ALL_PASS_PLANS;
    if (user.passStatus === 'Gold') return [];
    if (user.passStatus === 'Silver') return ALL_PASS_PLANS.filter((p) => p.id === 'gold');
    return ALL_PASS_PLANS;
  }, [user]);

  const goToCheckout = (plan: PassPlan) => {
    const chargePrice = chargeForPassSelection(plan.id as 'gold' | 'silver', user?.passStatus ?? 'None');
    navigate('/purchase-pass/checkout', {
      state: {
        selectedPlan: { ...plan, chargePrice },
        planType: 'premium-pass',
      },
    });
  };

  return (
    <div className="purchase-pass-page">
      <main className="pass-main">
        <section className="hero-section">
          <Link to="/home" className="back-link">← Back to Home</Link>
          <h2>Purchase Premium Passes</h2>
          <p>Skip the line and get priority access to tickets!</p>
        </section>

        <section className="benefits-section">
          <h3>Why Get a Premium Pass?</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon"><FaBolt /></div>
              <h4>Skip the Line</h4>
              <p>Jump ahead of regular users until venue capacity thresholds are met!</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon"><FaBullseye /></div>
              <h4>Guaranteed Access</h4>
              <p>Get priority placement in queue based on your pass level!</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon"><FaClock /></div>
              <h4>Save Time</h4>
              <p>Spend less time waiting and more time enjoying concerts!</p>
            </div>
          </div>
        </section>

        {user?.passStatus === 'Gold' && (
          <section className="plans-section">
            <p>
              You already have a Gold pass (our highest tier). Passes stay on your account until they expire—they
              can&apos;t be removed after purchase.
            </p>
            <Link to="/home" className="back-link">
              ← Back to Home
            </Link>
          </section>
        )}

        {user?.passStatus !== 'Gold' && (
          <section className="plans-section">
            <h3>{user?.passStatus === 'Silver' ? 'Upgrade to Gold' : 'Choose Your Pass'}</h3>
            <div className="plans-grid">
              {visiblePlans.map((plan) => {
                const isSilverUpgrade = user?.passStatus === 'Silver' && plan.id === 'gold';
                const displayPrice = chargeForPassSelection(plan.id as 'gold' | 'silver', user?.passStatus ?? 'None');
                return (
                  <div
                    key={plan.id}
                    className={`plan-card ${plan.recommended ? 'recommended' : ''}`}
                  >
                    {plan.recommended && <div className="recommended-badge">Most Popular</div>}

                    <div className="plan-header">
                      <h4>{plan.name}</h4>
                      <div className="plan-price">
                        {isSilverUpgrade ? (
                          <>
                            <span className="price">${displayPrice}</span>
                            <span className="duration"> upgrade</span>
                            <p className="upgrade-price-note">
                              Upgrade from Silver: pay <strong>${displayPrice.toFixed(2)}</strong> (${GOLD_PASS_PRICE} Gold −{' '}
                              {SILVER_PASS_PRICE} Silver).
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="price">${plan.price}</span>
                            <span className="duration">/{plan.duration}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="plan-features">
                      <ul>
                        {plan.features.map((feature, index) => (
                          <li key={index}>
                            <span className="checkmark">
                              <FaCheck />
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <div className="capacity-explanation">
                        <p className="capacity-text">
                          {plan.id === 'silver'
                            ? 'You’ll skip the entire line until 25% of tickets are sold, then the pass stops working.'
                            : 'You’ll skip the entire line until 50% of tickets are sold, then the pass stops working.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="select-plan-btn purchase-this-pass-btn"
                      onClick={() => goToCheckout(plan)}
                    >
                      Purchase this pass
                    </button>
                  </div>
                );
              })}
            </div>

            {visiblePlans.length > 1 && (
              <div className="priority-note">
                <p className="note-text">
                  <em>
                    Both Silver and Gold Passes hold the same priority level - Gold simply works until 50% venue
                    capacity is reached, while Silver stops at 25% capacity.
                  </em>
                </p>
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
};

export default PurchasePassPage;