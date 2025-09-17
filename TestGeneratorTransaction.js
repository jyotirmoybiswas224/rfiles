import React from 'react';
import GeneratorTransaction from './GeneratorTransaction.js';

/**
 * Simple test component to validate GeneratorTransaction functionality
 */
const TestGeneratorTransaction = () => {
  // Mock generator data with available credits
  const mockGeneratorData = {
    id: 'gen-123',
    name: 'Test Generator',
    availableCredits: [
      {
        id: 'credit-001',
        number: 'CM-2024-001',
        amount: 150.50,
      },
      {
        id: 'credit-002',
        number: 'CM-2024-002',
        amount: 75.25,
      },
    ],
  };

  // Handler for transaction completion
  const handleTransactionComplete = (transactionData) => {
    console.log('Transaction completed in test:', transactionData);
    alert(`Transaction completed: ${transactionData.type} - $${transactionData.amount}`);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Generator Transaction Test</h1>
      <p>Generator: {mockGeneratorData.name}</p>
      <p>Available Credits: {mockGeneratorData.availableCredits.length}</p>
      
      <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <GeneratorTransaction
          generatorData={mockGeneratorData}
          onTransactionComplete={handleTransactionComplete}
        />
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h3>Test Instructions:</h3>
        <ol>
          <li><strong>Receive Payment:</strong> Click "Receive Payment" button to open modal with default payment options</li>
          <li><strong>Apply Credit:</strong> Click "Apply Credit" button to open the same modal but with credit memo pre-selected</li>
          <li>Verify that the modal shows appropriate fields based on the action</li>
          <li>Verify that credit memo is pre-selected when applying credit</li>
          <li>Test form submission and completion handling</li>
        </ol>
      </div>
    </div>
  );
};

export default TestGeneratorTransaction;