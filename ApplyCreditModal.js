import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

const ApplyCreditModal = ({ 
    isOpen, 
    onClose, 
    creditMemo, 
    invoices, 
    onApply, 
    loading 
}) => {
    const [allocations, setAllocations] = useState([]);
    const [errors, setErrors] = useState({});

    // Initialize allocations when modal opens or invoices change
    useEffect(() => {
        if (isOpen && invoices.length > 0) {
            const initialAllocations = invoices.map(invoice => ({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber || invoice.id,
                invoiceAmount: invoice.amount || 0,
                remainingAmount: invoice.remainingAmount || invoice.amount || 0,
                amount: 0
            }));
            setAllocations(initialAllocations);
            setErrors({});
        }
    }, [isOpen, invoices]);

    // Calculate total allocated amount
    const totalAllocated = useMemo(() => {
        return allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.amount) || 0), 0);
    }, [allocations]);

    // Calculate remaining credit amount
    const remainingCredit = useMemo(() => {
        return (creditMemo?.remainingAmount || 0) - totalAllocated;
    }, [creditMemo?.remainingAmount, totalAllocated]);

    // Validate allocations
    const validateAllocations = () => {
        const newErrors = {};
        let hasValidAllocations = false;

        allocations.forEach((allocation, index) => {
            const amount = parseFloat(allocation.amount) || 0;
            
            if (amount > 0) {
                hasValidAllocations = true;
                
                // Check if amount exceeds invoice remaining amount
                if (amount > allocation.remainingAmount) {
                    newErrors[index] = `Amount cannot exceed invoice remaining balance of $${allocation.remainingAmount.toFixed(2)}`;
                }
            }
        });

        // Check if total allocated exceeds credit memo amount
        if (totalAllocated > (creditMemo?.remainingAmount || 0)) {
            newErrors.total = `Total allocation ($${totalAllocated.toFixed(2)}) cannot exceed available credit ($${(creditMemo?.remainingAmount || 0).toFixed(2)})`;
        }

        // Check if no allocations are made
        if (!hasValidAllocations) {
            newErrors.general = "Please allocate credit to at least one invoice";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAllocationChange = (index, value) => {
        const numValue = parseFloat(value) || 0;
        const newAllocations = [...allocations];
        newAllocations[index] = {
            ...newAllocations[index],
            amount: numValue
        };
        setAllocations(newAllocations);
        
        // Clear specific error for this field
        if (errors[index]) {
            const newErrors = { ...errors };
            delete newErrors[index];
            setErrors(newErrors);
        }
        
        // Clear total error if it exists
        if (errors.total) {
            const newErrors = { ...errors };
            delete newErrors.total;
            setErrors(newErrors);
        }
    };

    const handleApplyMaxToInvoice = (index) => {
        const allocation = allocations[index];
        const maxApplicable = Math.min(
            allocation.remainingAmount,
            remainingCredit + (parseFloat(allocation.amount) || 0)
        );
        handleAllocationChange(index, maxApplicable);
    };

    const handleApplyRemaining = () => {
        if (remainingCredit <= 0) return;
        
        // Find invoices that can still receive credit
        const availableInvoices = allocations.filter(allocation => 
            allocation.remainingAmount > (parseFloat(allocation.amount) || 0)
        );
        
        if (availableInvoices.length === 0) return;
        
        let remainingToDistribute = remainingCredit;
        const newAllocations = [...allocations];
        
        // Distribute remaining credit proportionally
        availableInvoices.forEach(allocation => {
            const index = allocations.findIndex(a => a.invoiceId === allocation.invoiceId);
            const currentAmount = parseFloat(allocation.amount) || 0;
            const maxAdditional = allocation.remainingAmount - currentAmount;
            const amountToAdd = Math.min(maxAdditional, remainingToDistribute);
            
            newAllocations[index] = {
                ...newAllocations[index],
                amount: currentAmount + amountToAdd
            };
            
            remainingToDistribute -= amountToAdd;
        });
        
        setAllocations(newAllocations);
    };

    const handleSubmit = () => {
        if (!validateAllocations()) {
            return;
        }

        // Filter out zero allocations
        const validAllocations = allocations.filter(allocation => 
            parseFloat(allocation.amount) > 0
        );

        onApply(creditMemo, validAllocations);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const formatDate = (date) => {
        if (!date) return "N/A";
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Apply Credit Memo</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Credit Memo Information */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-medium text-green-900 mb-2">Credit Memo Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="font-medium text-green-700">Credit Memo #:</span>
                            <div className="text-green-900">{creditMemo?.creditMemoNumber || creditMemo?.id}</div>
                        </div>
                        <div>
                            <span className="font-medium text-green-700">Date:</span>
                            <div className="text-green-900">{formatDate(creditMemo?.date)}</div>
                        </div>
                        <div>
                            <span className="font-medium text-green-700">Original Amount:</span>
                            <div className="text-green-900">{formatCurrency(creditMemo?.amount)}</div>
                        </div>
                        <div>
                            <span className="font-medium text-green-700">Available Credit:</span>
                            <div className="text-green-900 font-bold">{formatCurrency(creditMemo?.remainingAmount)}</div>
                        </div>
                    </div>
                </div>

                {/* Credit Allocation Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm flex-1">
                            <div>
                                <span className="font-medium text-blue-700">Total Allocated:</span>
                                <div className="text-blue-900 font-bold">{formatCurrency(totalAllocated)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-blue-700">Remaining Credit:</span>
                                <div className={`font-bold ${remainingCredit >= 0 ? 'text-blue-900' : 'text-red-600'}`}>
                                    {formatCurrency(remainingCredit)}
                                </div>
                            </div>
                            <div>
                                <button
                                    onClick={handleApplyRemaining}
                                    disabled={remainingCredit <= 0 || loading}
                                    className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1 rounded"
                                >
                                    Apply Remaining
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Messages */}
                {(errors.general || errors.total) && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="text-red-800">
                            {errors.general && <div>{errors.general}</div>}
                            {errors.total && <div>{errors.total}</div>}
                        </div>
                    </div>
                )}

                {/* Invoice Allocation Table */}
                <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Allocate Credit to Invoices</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full bg-white">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Invoice #
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Invoice Amount
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Remaining Balance
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Credit to Apply
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {allocations.map((allocation, index) => (
                                    <tr key={allocation.invoiceId} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                            {allocation.invoiceNumber}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-900">
                                            {formatCurrency(allocation.invoiceAmount)}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-900">
                                            {formatCurrency(allocation.remainingAmount)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max={allocation.remainingAmount}
                                                    value={allocation.amount || ''}
                                                    onChange={(e) => handleAllocationChange(index, e.target.value)}
                                                    className={`w-24 px-2 py-1 text-sm border rounded ${
                                                        errors[index] ? 'border-red-500' : 'border-gray-300'
                                                    }`}
                                                    disabled={loading}
                                                />
                                                {errors[index] && (
                                                    <div className="text-xs text-red-500 mt-1">
                                                        {errors[index]}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={() => handleApplyMaxToInvoice(index)}
                                                disabled={allocation.remainingAmount <= (parseFloat(allocation.amount) || 0) || loading}
                                                className="text-xs bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-2 py-1 rounded"
                                            >
                                                Apply Max
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {allocations.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="py-8 text-center text-gray-500">
                                            No outstanding invoices available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-full hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || totalAllocated <= 0}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full"
                    >
                        {loading ? "Applying..." : `Apply ${formatCurrency(totalAllocated)} Credit`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApplyCreditModal;