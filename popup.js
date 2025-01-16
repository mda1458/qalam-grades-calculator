// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const fetchTablesBtn = document.getElementById('fetchTablesBtn');
    const calculateAggregatesBtn = document.getElementById('calculateAggregatesBtn');
    const resultArea = document.getElementById('resultArea');
  
    // 1) Example: "Fetch Tables" (You can adapt logic as needed)
    fetchTablesBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
  
      // For demonstration, let’s just return how many <tbody> elements we find
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return document.getElementsByTagName('tbody').length;
        },
      });
  
      const count = results?.[0]?.result || 0;
      resultArea.innerHTML = `<p>Number of Result tables found: <strong>${count}</strong></p>`;
    });
  
    // 2) "Calculate Aggregates" using your `processAssessments()`
    calculateAggregatesBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
  
      // Execute the function that we attached to window in contentScript.js
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
  const tableBody = Array.from(document.getElementsByTagName('tbody'));
  if (!tableBody) {
      return { error: "No <tbody> found on this page." };
  }
  const results = [];
  tableBody.forEach(tb => {
    const tableRows = Array.from(tb.children);

    // Filter out the rows which have class table-parent-row
    const assessmentRows = tableRows.filter(row => row.classList.contains('table-parent-row'));
    const evaluation = [];
    // Get Assessment name and its aggregate contribution
    tableRows.forEach(row => {
        if (row.classList.contains('table-parent-row')){
            const typeCell = row.querySelector('a.js-toggle-children-row');
            const weightBadge = typeCell.querySelector('.uk-badge');

            evaluation.push({
                index: evaluation.length,
                typeCell,
                weightBadge,
                childRows: [],
                yourPercentage: 0,
                avgPercentage: 0,
                yourAggregate: 0,
                avgAggregate: 0
            });
        } else {
            // Attach to the last evaluation
            evaluation[evaluation.length - 1].childRows.push(row);
        }
    });

    // Calculate the aggregate for each assessment
    evaluation.forEach(e => {
        e.childRows.forEach(childRow => {
            // Skip certain rows
            if (childRow.classList.contains("table-child-row md-bg-blue-grey-800 md-color-grey-50")) return;

            const maxMarksCell = childRow.querySelector('td:nth-child(2)');
            const obtainedMarksCell = childRow.querySelector('td:nth-child(3)');
            const avgMarksCell = childRow.querySelector('td:nth-child(4)');
            
            if (maxMarksCell && obtainedMarksCell && avgMarksCell) {
                const maxMarks = parseFloat(maxMarksCell.textContent.trim());
                const obtainedMarks = parseFloat(obtainedMarksCell.textContent.trim());
                const avgMarks = parseFloat(avgMarksCell.textContent.trim());

                if (!isNaN(maxMarks) && !isNaN(obtainedMarks) && !isNaN(avgMarks)) {
                    e.yourPercentage += (obtainedMarks / maxMarks) * 100;
                    e.avgPercentage  += (avgMarks / maxMarks)    * 100;
                }
            }
        });

        // childRows.length - 1, because first row is presumably the parent row?
        const divisor = (e.childRows.length - 1) || 1;
        e.yourAggregate = e.yourPercentage / divisor;
        e.avgAggregate = e.avgPercentage / divisor;
    });

    // Calculate the total aggregate and average aggregate
    const yourTotalAggregate = evaluation.reduce((acc, assessment) => {
        const weight = parseFloat(assessment.weightBadge.textContent.trim().replace('%', ''));
        return acc + (weight * assessment.yourAggregate) / 100;
    }, 0);

    const averageTotalAggregate = evaluation.reduce((acc, assessment) => {
        const weight = parseFloat(assessment.weightBadge.textContent.trim().replace('%', ''));
        return acc + (weight * assessment.avgAggregate) / 100;
    }, 0);

    results.push({
        evaluation,
        yourTotalAggregate,
        averageTotalAggregate
    });
    });

    // Return your final values in an object so we can display them in the popup
    return results;
        } 
      });
  
      // 'results' is an array of results—one per frame. Typically we want results[0].result.
      const data = results[0]?.result;
      let inner = '';
  
      if (data && !data.error) {
        data.forEach((result,idx) => {
        const { evaluation, yourTotalAggregate, averageTotalAggregate } = result;
  
        // Display summary in the popup
        inner += `
          <h2>Results for Table ${idx + 1}</h2>
          <div class="summary">
            <p><strong>Your Total Aggregate:</strong> ${yourTotalAggregate.toFixed(2)}%</p>
            <p><strong>Average Total Aggregate:</strong> ${averageTotalAggregate.toFixed(2)}%</p>
          </div>
          <hr>
          <hr>
        `;
        });

        resultArea.innerHTML = inner;
      } else {
        resultArea.innerHTML = `
          <p style="color: red;">
            Could not process assessments. ${data?.error ?? ''}
          </p>
        `;
      }
    });
  });
  