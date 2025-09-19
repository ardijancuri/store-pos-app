// Utility function to open PDF as blob in new tab instead of downloading
export const openPdfInNewTab = (doc, filename) => {
  try {
    // Generate PDF blob
    const pdfBlob = doc.output('blob');
    
    // Create object URL
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Open in new tab
    const newWindow = window.open(pdfUrl, '_blank');
    
    // Clean up object URL after a delay to allow the browser to load it
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 1000);
    
    // Focus the new window
    if (newWindow) {
      newWindow.focus();
    }
    
    return true;
  } catch (error) {
    console.error('Error opening PDF in new tab:', error);
    return false;
  }
};

// Alternative method using data URL (for older browsers)
export const openPdfAsDataUrl = (doc, filename) => {
  try {
    // Generate PDF data URL
    const pdfDataUrl = doc.output('dataurlstring');
    
    // Open in new tab
    const newWindow = window.open(pdfDataUrl, '_blank');
    
    // Focus the new window
    if (newWindow) {
      newWindow.focus();
    }
    
    return true;
  } catch (error) {
    console.error('Error opening PDF as data URL:', error);
    return false;
  }
};
