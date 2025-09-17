// Integration Example: How to use GeneratorTransaction in existing billing pages

import React from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../../../../../../../../config/firebase";
import GeneratorTransaction from "./GeneratorTransaction";

// Example integration in a generator billing page
const GeneratorBillingPage = ({ generatorData }) => {
    const [user] = useAuthState(auth);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                
                {/* Page Header */}
                <div className="bg-white shadow rounded-lg mb-6">
                    <div className="px-4 py-5 sm:px-6">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Billing Management - {generatorData?.generatorName}
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Manage invoices, payments, and credit applications
                        </p>
                    </div>
                </div>

                {/* Billing Navigation Tabs */}
                <div className="bg-white shadow rounded-lg mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6">
                            <button className="border-blue-500 text-blue-600 py-2 px-1 border-b-2 font-medium text-sm">
                                Transactions
                            </button>
                            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-2 px-1 border-b-2 font-medium text-sm">
                                Invoices
                            </button>
                            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-2 px-1 border-b-2 font-medium text-sm">
                                Payment Methods
                            </button>
                            <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-2 px-1 border-b-2 font-medium text-sm">
                                Credit Memos
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Transaction Management Component */}
                <GeneratorTransaction 
                    generatorData={generatorData}
                    user={user}
                />

                {/* Additional Billing Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    
                    {/* Billing Summary */}
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:px-6">
                            <h3 className="text-lg font-medium text-gray-900">Billing Summary</h3>
                        </div>
                        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Outstanding Balance</dt>
                                    <dd className="mt-1 text-sm text-gray-900">$1,247.50</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Available Credit</dt>
                                    <dd className="mt-1 text-sm text-green-600">$750.00</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Last Payment</dt>
                                    <dd className="mt-1 text-sm text-gray-900">Jan 15, 2024</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Next Invoice Date</dt>
                                    <dd className="mt-1 text-sm text-gray-900">Feb 1, 2024</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:px-6">
                            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
                        </div>
                        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                            <div className="space-y-4">
                                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                                    Generate Invoice
                                </button>
                                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg">
                                    Process Payment
                                </button>
                                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg">
                                    Create Credit Memo
                                </button>
                                <button className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg">
                                    Export Records
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneratorBillingPage;

/* 
USAGE EXAMPLE:

1. In your billing route component:
   import GeneratorBillingPage from './GeneratorBillingPage';

2. In your route definition:
   <Route path="/admin/generators/:id/generator-billing" 
          element={<GeneratorBillingPage generatorData={generatorData} />} />

3. The GeneratorTransaction component will automatically:
   - Display all transactions and credit memos
   - Handle "Apply Credit" button clicks
   - Open the ApplyCreditModal when needed
   - Manage all credit application logic and validation
   - Update database records atomically

4. Required Firebase Collections:
   - transactions: { id, generatorId, type, amount, status, date, ... }
   - creditMemos: { id, generatorId, amount, remainingAmount, status, date, ... }
   - invoices: { id, generatorId, amount, remainingAmount, status, date, ... }

5. Component Props:
   - generatorData: { id, generatorName, ... }
   - user: Firebase user object with uid
*/