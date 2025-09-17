import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * GeneratorTransaction component handles billing transactions including
 * receiving payments and applying credits for generator billing settings.
 */
const GeneratorTransaction = ({ generatorData, onTransactionComplete }) => {
  const [isReceivePaymentModalOpen, setIsReceivePaymentModalOpen] = useState(false);
  const [selectedCreditMemo, setSelectedCreditMemo] = useState(null);
  const [transactionType, setTransactionType] = useState(null);

  /**
   * Handle transaction actions for both receive-payment and apply-credit
   * This function reuses the same Receive Payment modal for both actions
   * @param {string} action - The action type ('receive-payment' or 'apply-credit')
   * @param {Object} data - Optional data for the action (e.g., credit memo for apply-credit)
   */
  const handleTransactionAction = useCallback((action, data = null) => {
    console.log(`Handling transaction action: ${action}`, data);
    
    switch (action) {
      case 'receive-payment':
        // Open the Receive Payment modal in standard mode
        setTransactionType('receive-payment');
        setSelectedCreditMemo(null);
        setIsReceivePaymentModalOpen(true);
        break;
      
      case 'apply-credit':
        // Open the same Receive Payment modal but pre-select the credit memo
        setTransactionType('apply-credit');
        setSelectedCreditMemo(data?.creditMemo || null);
        setIsReceivePaymentModalOpen(true);
        break;
      
      default:
        console.warn(`Unknown transaction action: ${action}`);
        break;
    }
  }, []);

  /**
   * Handle closing the Receive Payment modal
   */
  const handleCloseReceivePaymentModal = useCallback(() => {
    setIsReceivePaymentModalOpen(false);
    setSelectedCreditMemo(null);
    setTransactionType(null);
  }, []);

  /**
   * Handle successful transaction completion
   */
  const handleTransactionSuccess = useCallback((transactionData) => {
    console.log('Transaction completed successfully:', transactionData);
    
    // Close the modal
    handleCloseReceivePaymentModal();
    
    // Notify parent component if callback provided
    if (onTransactionComplete) {
      onTransactionComplete(transactionData);
    }
  }, [onTransactionComplete, handleCloseReceivePaymentModal]);

  return (
    <div className="generator-transaction">
      {/* Transaction Action Buttons */}
      <div className="transaction-actions flex gap-4 mb-4">
        <button
          type="button"
          className="rounded-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white transition"
          onClick={() => handleTransactionAction('receive-payment')}
        >
          Receive Payment
        </button>
        
        <button
          type="button"
          className="rounded-full px-4 py-2 text-sm bg-secondary-500 hover:bg-secondary-500/90 text-white transition"
          onClick={() => handleTransactionAction('apply-credit', { creditMemo: generatorData?.availableCredits?.[0] })}
        >
          Apply Credit
        </button>
      </div>

      {/* Receive Payment Modal */}
      {isReceivePaymentModalOpen && (
        <ReceivePaymentModal
          isOpen={isReceivePaymentModalOpen}
          onClose={handleCloseReceivePaymentModal}
          onSuccess={handleTransactionSuccess}
          generatorData={generatorData}
          transactionType={transactionType}
          preSelectedCreditMemo={selectedCreditMemo}
        />
      )}
    </div>
  );
};

/**
 * Receive Payment Modal component that handles both payment receiving and credit application
 */
const ReceivePaymentModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  generatorData, 
  transactionType,
  preSelectedCreditMemo 
}) => {
  const [paymentMethod, setPaymentMethod] = useState(
    transactionType === 'apply-credit' ? 'credit-memo' : 'cash'
  );
  const [amount, setAmount] = useState('');
  const [selectedCredit, setSelectedCredit] = useState(preSelectedCreditMemo);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set the selected credit memo when the modal opens for apply-credit action
  React.useEffect(() => {
    if (transactionType === 'apply-credit' && preSelectedCreditMemo) {
      setSelectedCredit(preSelectedCreditMemo);
      setPaymentMethod('credit-memo');
      setAmount(preSelectedCreditMemo.amount || '');
    }
  }, [transactionType, preSelectedCreditMemo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate transaction processing
      const transactionData = {
        type: transactionType,
        paymentMethod,
        amount: parseFloat(amount),
        creditMemo: selectedCredit,
        generatorId: generatorData?.id,
        timestamp: new Date().toISOString(),
      };

      // TODO: Add actual transaction processing logic here
      console.log('Processing transaction:', transactionData);
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000));

      onSuccess(transactionData);
    } catch (error) {
      console.error('Transaction failed:', error);
      // TODO: Add error handling
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {transactionType === 'apply-credit' ? 'Apply Credit' : 'Receive Payment'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={transactionType === 'apply-credit'}
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit-card">Credit Card</option>
              <option value="credit-memo">Credit Memo</option>
            </select>
          </div>

          {/* Credit Memo Selection (shown when payment method is credit-memo) */}
          {paymentMethod === 'credit-memo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Credits
              </label>
              <select
                value={selectedCredit?.id || ''}
                onChange={(e) => {
                  const credit = generatorData?.availableCredits?.find(c => c.id === e.target.value);
                  setSelectedCredit(credit);
                  setAmount(credit?.amount || '');
                }}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select a credit memo</option>
                {generatorData?.availableCredits?.map((credit) => (
                  <option key={credit.id} value={credit.id}>
                    Credit #{credit.number} - ${credit.amount}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0.00"
              required
              disabled={paymentMethod === 'credit-memo' && selectedCredit}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : (transactionType === 'apply-credit' ? 'Apply Credit' : 'Receive Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// PropTypes for type checking
GeneratorTransaction.propTypes = {
  generatorData: PropTypes.shape({
    id: PropTypes.string,
    availableCredits: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      number: PropTypes.string,
      amount: PropTypes.number,
    })),
  }),
  onTransactionComplete: PropTypes.func,
};

ReceivePaymentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  generatorData: PropTypes.object,
  transactionType: PropTypes.oneOf(['receive-payment', 'apply-credit']),
  preSelectedCreditMemo: PropTypes.object,
};

export default GeneratorTransaction;