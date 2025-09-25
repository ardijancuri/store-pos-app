import React from 'react';
import { useAuth } from '../contexts/AuthContext';

// Admin-only wrapper component
export const AdminOnly = ({ children, fallback = null }) => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return children;
  }
  
  return fallback;
};

// Date range selector component
export const DateRangeSelector = ({ 
  dateFrom, 
  setDateFrom, 
  dateTo, 
  setDateTo, 
  className = "flex items-center gap-2",
  inputClassName = "input text-sm w-36"
}) => {
  return (
    <div className={className}>
      <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className={inputClassName}
        placeholder="From"
      />
      <span className="text-gray-500">to</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className={inputClassName}
        placeholder="To"
      />
    </div>
  );
};

// Generate report button component
export const GenerateReportButton = ({ 
  onClick, 
  title, 
  className = "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors w-full sm:w-auto",
  children = "Generate Report",
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      className={className}
      title={title}
      disabled={disabled}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {children}
    </button>
  );
};

// Barcode report button component
export const BarcodeReportButton = ({ 
  onClick, 
  disabled, 
  title,
  className = "px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
}) => {
  const buttonClassName = disabled
    ? `${className} bg-gray-400 text-gray-200 cursor-not-allowed`
    : `${className} bg-blue-600 hover:bg-blue-700 text-white`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
      title={title}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Barcode
    </button>
  );
};

// Admin-only date range selector wrapper
export const AdminDateRangeSelector = ({ dateFrom, setDateFrom, dateTo, setDateTo, className, inputClassName }) => {
  return (
    <AdminOnly>
      <DateRangeSelector 
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        className={className}
        inputClassName={inputClassName}
      />
    </AdminOnly>
  );
};

// Admin-only generate report button wrapper
export const AdminGenerateReportButton = ({ onClick, title, className, children, disabled }) => {
  return (
    <AdminOnly>
      <GenerateReportButton 
        onClick={onClick}
        title={title}
        className={className}
        children={children}
        disabled={disabled}
      />
    </AdminOnly>
  );
};

// Admin-only barcode report button wrapper
export const AdminBarcodeReportButton = ({ onClick, disabled, title, className }) => {
  return (
    <AdminOnly>
      <BarcodeReportButton 
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={className}
      />
    </AdminOnly>
  );
};
