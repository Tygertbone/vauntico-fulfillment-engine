/**
 * 🛡️ Vauntico TrustScore Framework
 * Component: Fulfillment Accuracy Rate (FAR)
 * Purpose: Tracks the reliability of digital deliveries to build creator creditworthiness.
 */

const fs = require('fs');
const path = require('path');

// The "Green State" log where we track our wins
const LOG_PATH = path.join(__dirname, '../fulfillment_metrics.json');

const recordFulfillment = async (success, error = null) => {
    const timestamp = new Date().toISOString();
    
    const metric = {
        timestamp,
        status: success ? 'SUCCESS' : 'FAILED',
        errorCode: error ? error.code : null,
        impact: "TrustScore_Update"
    };

    try {
        // Load existing metrics or start fresh
        let data = { total: 0, successful: 0, accuracy_rate: 0, history: [] };
        if (fs.existsSync(LOG_PATH)) {
            data = JSON.parse(fs.readFileSync(LOG_PATH));
        }

        // Update calculations
        data.total += 1;
        if (success) data.successful += 1;
        data.accuracy_rate = (data.successful / data.total) * 100;
        
        // Keep the history lean (last 100 events)
        data.history.unshift(metric);
        if (data.history.length > 100) data.history.pop();

        fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
        
        console.log(`📊 TrustScore Updated: ${data.accuracy_rate.toFixed(2)}% Accuracy`);
        return data;
    } catch (err) {
        console.error("❌ Failed to update TrustScore metrics:", err);
    }
};

module.exports = { recordFulfillment };
