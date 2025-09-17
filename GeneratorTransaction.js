import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { 
    collection, 
    doc, 
    getDocs, 
    query, 
    updateDoc, 
    where, 
    writeBatch 
} from "firebase/firestore";
import { db, COLLECTIONS } from "../../../../../../../../config/firebase";
import ApplyCreditModal from "./ApplyCreditModal";

const GeneratorTransaction = ({ generatorData, user }) => {
    const [transactions, setTransactions] = useState([]);
    const [creditMemos, setCreditMemos] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [isApplyCreditModalOpen, setIsApplyCreditModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch transactions, credit memos, and invoices
    useEffect(() => {
        if (generatorData?.id) {
            fetchTransactions();
            fetchCreditMemos();
            fetchInvoices();
        }
    }, [generatorData?.id]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const transactionsRef = collection(db, COLLECTIONS.transactions || "transactions");
            const q = query(transactionsRef, where("generatorId", "==", generatorData.id));
            const snapshot = await getDocs(q);
            
            const transactionsList = [];
            snapshot.forEach((doc) => {
                transactionsList.push({ id: doc.id, ...doc.data() });
            });
            
            setTransactions(transactionsList);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            toast.error("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    };

    const fetchCreditMemos = async () => {
        try {
            const creditMemosRef = collection(db, COLLECTIONS.creditMemos || "creditMemos");
            const q = query(
                creditMemosRef, 
                where("generatorId", "==", generatorData.id),
                where("status", "==", "available")
            );
            const snapshot = await getDocs(q);
            
            const creditMemosList = [];
            snapshot.forEach((doc) => {
                creditMemosList.push({ id: doc.id, ...doc.data() });
            });
            
            setCreditMemos(creditMemosList);
        } catch (error) {
            console.error("Error fetching credit memos:", error);
            toast.error("Failed to load credit memos");
        }
    };

    const fetchInvoices = async () => {
        try {
            const invoicesRef = collection(db, COLLECTIONS.invoices || "invoices");
            const q = query(
                invoicesRef, 
                where("generatorId", "==", generatorData.id),
                where("status", "in", ["pending", "overdue"])
            );
            const snapshot = await getDocs(q);
            
            const invoicesList = [];
            snapshot.forEach((doc) => {
                invoicesList.push({ id: doc.id, ...doc.data() });
            });
            
            setInvoices(invoicesList);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast.error("Failed to load invoices");
        }
    };

    const handleTransactionAction = (action, transaction) => {
        switch (action) {
            case "apply-credit":
                if (!transaction || transaction.type !== "credit-memo") {
                    toast.error("Please select a valid credit memo to apply");
                    return;
                }
                
                if (transaction.remainingAmount <= 0) {
                    toast.error("This credit memo has no remaining balance");
                    return;
                }

                if (invoices.length === 0) {
                    toast.error("No outstanding invoices available to apply credit to");
                    return;
                }

                setSelectedTransaction(transaction);
                setIsApplyCreditModalOpen(true);
                break;
                
            case "view-details":
                // Handle view details
                console.log("Viewing transaction details:", transaction);
                break;
                
            case "download-receipt":
                // Handle download receipt
                console.log("Downloading receipt for:", transaction);
                break;
                
            default:
                console.log("Unknown action:", action);
        }
    };

    const handleApplyCredit = async (creditMemo, allocations) => {
        try {
            setLoading(true);
            const batch = writeBatch(db);

            let totalAllocated = 0;
            const updates = [];

            // Validate allocations
            for (const allocation of allocations) {
                if (allocation.amount <= 0) continue;
                
                totalAllocated += allocation.amount;
                
                // Find the invoice
                const invoice = invoices.find(inv => inv.id === allocation.invoiceId);
                if (!invoice) {
                    throw new Error(`Invoice ${allocation.invoiceId} not found`);
                }

                // Check if allocation doesn't exceed invoice amount
                if (allocation.amount > invoice.remainingAmount) {
                    throw new Error(`Cannot apply $${allocation.amount} to invoice ${invoice.invoiceNumber}. Remaining amount is $${invoice.remainingAmount}`);
                }

                updates.push({ invoice, allocation });
            }

            // Check if total allocated doesn't exceed credit memo amount
            if (totalAllocated > creditMemo.remainingAmount) {
                throw new Error(`Total allocation ($${totalAllocated}) exceeds available credit ($${creditMemo.remainingAmount})`);
            }

            // Update invoices
            for (const { invoice, allocation } of updates) {
                const invoiceRef = doc(db, COLLECTIONS.invoices || "invoices", invoice.id);
                const newRemainingAmount = invoice.remainingAmount - allocation.amount;
                const newStatus = newRemainingAmount <= 0 ? "paid" : invoice.status;

                batch.update(invoiceRef, {
                    remainingAmount: newRemainingAmount,
                    status: newStatus,
                    appliedCredits: [
                        ...(invoice.appliedCredits || []),
                        {
                            creditMemoId: creditMemo.id,
                            amount: allocation.amount,
                            appliedDate: new Date(),
                            appliedBy: user?.uid
                        }
                    ]
                });
            }

            // Update credit memo
            const creditMemoRef = doc(db, COLLECTIONS.creditMemos || "creditMemos", creditMemo.id);
            const newCreditRemainingAmount = creditMemo.remainingAmount - totalAllocated;
            const newCreditStatus = newCreditRemainingAmount <= 0 ? "fully-applied" : "partially-applied";

            batch.update(creditMemoRef, {
                remainingAmount: newCreditRemainingAmount,
                status: newCreditStatus,
                appliedAllocations: [
                    ...(creditMemo.appliedAllocations || []),
                    ...allocations.map(allocation => ({
                        ...allocation,
                        appliedDate: new Date(),
                        appliedBy: user?.uid
                    }))
                ]
            });

            // Commit the batch
            await batch.commit();

            toast.success(`Successfully applied $${totalAllocated} in credit`);
            
            // Refresh data
            await Promise.all([
                fetchTransactions(),
                fetchCreditMemos(),
                fetchInvoices()
            ]);

            setIsApplyCreditModalOpen(false);
            setSelectedTransaction(null);

        } catch (error) {
            console.error("Error applying credit:", error);
            toast.error(error.message || "Failed to apply credit");
        } finally {
            setLoading(false);
        }
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

    const renderTransactionRow = (transaction) => {
        const isCredit = transaction.type === "credit-memo";
        const hasRemainingBalance = isCredit && transaction.remainingAmount > 0;

        return (
            <tr key={transaction.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-3 px-4">{transaction.transactionNumber || transaction.id}</td>
                <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        isCredit ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                        {transaction.type === "credit-memo" ? "Credit Memo" : "Invoice"}
                    </span>
                </td>
                <td className="py-3 px-4">{formatDate(transaction.date)}</td>
                <td className="py-3 px-4">{formatCurrency(transaction.amount)}</td>
                <td className="py-3 px-4">
                    {isCredit ? formatCurrency(transaction.remainingAmount) : "N/A"}
                </td>
                <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.status === "available" ? 'bg-green-100 text-green-800' :
                        transaction.status === "partially-applied" ? 'bg-yellow-100 text-yellow-800' :
                        transaction.status === "fully-applied" ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                    }`}>
                        {transaction.status}
                    </span>
                </td>
                <td className="py-3 px-4">
                    <div className="flex gap-2">
                        {hasRemainingBalance && (
                            <button
                                onClick={() => handleTransactionAction("apply-credit", transaction)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                disabled={loading}
                            >
                                Apply Credit
                            </button>
                        )}
                        <button
                            onClick={() => handleTransactionAction("view-details", transaction)}
                            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                        >
                            View Details
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="bg-white p-8 pt-6 mb-8 flex flex-col rounded-cardRadii flex-grow">
            <div className="grid gap-2">
                <h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC]">
                    Transaction Management
                </h6>
                
                {loading ? (
                    <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Transaction #
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Remaining
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {[...creditMemos, ...transactions].map(renderTransactionRow)}
                                {[...creditMemos, ...transactions].length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-gray-500">
                                            No transactions found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Apply Credit Modal */}
            {isApplyCreditModalOpen && selectedTransaction && (
                <ApplyCreditModal
                    isOpen={isApplyCreditModalOpen}
                    onClose={() => {
                        setIsApplyCreditModalOpen(false);
                        setSelectedTransaction(null);
                    }}
                    creditMemo={selectedTransaction}
                    invoices={invoices}
                    onApply={handleApplyCredit}
                    loading={loading}
                />
            )}
        </div>
    );
};

export default GeneratorTransaction;