// Prints an HTML document through a hidden frame: waits for it (and its images) to load,
// opens the browser's print dialog, then removes the frame. Shared by the egg chart and timelines.
(function () {
    'use strict';

    const PRINT_FALLBACK_DELAY_MS = 5000;
    const PRINT_CLEANUP_DELAY_MS = 2000;

    /**
     * @param {string} content a complete HTML document
     * @returns {boolean} false if the frame could not be created
     */
    const open = (content) => {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.opacity = '0';
            iframe.style.border = 'none';

            let printed = false;
            const printOnce = () => {
                if (printed) {
                    return;
                }
                printed = true;
                iframe.contentWindow.print();
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, PRINT_CLEANUP_DELAY_MS);
            };
            iframe.onload = printOnce;
            setTimeout(printOnce, PRINT_FALLBACK_DELAY_MS);

            iframe.srcdoc = content;
            document.body.appendChild(iframe);
            return true;
        } catch (error) {
            console.error('Print frame: could not open the print dialog', error);
            return false;
        }
    };

    window.GenMapperPrintFrame = { open };
})();
