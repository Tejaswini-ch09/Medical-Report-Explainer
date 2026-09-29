// =====================================================
// MEDICAL REPORT EXPLAINER
// =====================================================

// IMPORTANT:
// For local testing only.
// DO NOT upload a real API key to GitHub.

// PUT YOUR NEW API KEY HERE ON YOUR COMPUTER ONLY
const API_KEY = "const API_KEY = "YOUR_GEMINI_API_KEY";

const reportText = document.getElementById("reportText");
const pdfInput = document.getElementById("pdfInput");
const fileName = document.getElementById("fileName");

const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");

const summary = document.getElementById("summary");
const testResults = document.getElementById("testResults");
const observations = document.getElementById("observations");
const fullExplanation = document.getElementById("fullExplanation");

const questionInput = document.getElementById("questionInput");
const questionAnswer = document.getElementById("questionAnswer");

const language = document.getElementById("language");

let currentReport = "";
let currentExplanation = "";


// =====================================================
// PDF UPLOAD
// =====================================================

pdfInput.addEventListener("change", async function () {

    const file = this.files[0];

    if (!file) {
        return;
    }

    fileName.textContent = "Selected file: " + file.name;

    if (file.type !== "application/pdf") {
        alert("Please select a PDF file.");
        return;
    }

    try {

        currentReport = await extractPDFText(file);

        reportText.value = currentReport;

        alert("PDF text extracted successfully!");

    } catch (error) {

        console.error(error);

        alert(
            "Could not read this PDF. Please try another PDF or paste the report text manually."
        );
    }
});


// =====================================================
// EXTRACT TEXT FROM PDF
// =====================================================

async function extractPDFText(file) {

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    let completeText = "";

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map(item => item.str)
            .join(" ");

        completeText +=
            "\n\n--- Page " +
            pageNumber +
            " ---\n\n";

        completeText += pageText;
    }

    return completeText.trim();
}


// =====================================================
// SAMPLE REPORT
// =====================================================

function loadSampleReport() {

    const sample = `Patient Name: Sample Patient

Complete Blood Count

Hemoglobin: 12.5 g/dL
Reference Range: 12 - 16 g/dL

White Blood Cell Count: 7500 cells/µL
Reference Range: 4000 - 11000 cells/µL

Platelet Count: 250000 cells/µL
Reference Range: 150000 - 450000 cells/µL

Blood Glucose: 108 mg/dL
Reference Range: 70 - 100 mg/dL

Total Cholesterol: 185 mg/dL
Reference Range: Below 200 mg/dL

Vitamin D: 24 ng/mL
Reference Range: 30 - 100 ng/mL`;

    reportText.value = sample;

    currentReport = sample;
}


// =====================================================
// ANALYZE REPORT
// =====================================================

async function analyzeReport() {

    const text = reportText.value.trim();

    if (!text) {

        alert(
            "Please upload a medical report or paste the report text first."
        );

        return;
    }

    // Check API key
    if (
        API_KEY === "" ||
        API_KEY === "YOUR_GEMINI_API_KEY"
    ) {

        alert(
            "Please add your Gemini API key inside script.js before analyzing."
        );

        return;
    }

    currentReport = text;

    showLoading();

    try {

        const result = await sendToGemini(text);

        currentExplanation = result;

        displayResults(result);

    } catch (error) {

        console.error(error);

        alert(
            "Something went wrong while analyzing the report.\n\n" +
            error.message
        );

    } finally {

        hideLoading();
    }
}


// =====================================================
// SEND REPORT TO GEMINI
// =====================================================

async function sendToGemini(report) {
    const selectedLanguage = language.value;

    const prompt = `
You are an educational medical report explainer.

Analyze ONLY the medical report provided below.

Do NOT diagnose diseases.
Do NOT prescribe medicines.
Do NOT recommend medication doses.
Do NOT invent medical values or reference ranges.

Explain the report in simple language.

Use the reference ranges written in the report whenever available.

If a reference range is not provided, clearly say:

"Reference range not provided in the report."

Language:
${selectedLanguage}

Return your answer using EXACTLY these sections:

SUMMARY:
Give a short and simple summary.

TEST RESULTS:
For every important test, provide:

Test Name:
Value:
Unit:
Reference Range:
Status:
Simple Explanation:

IMPORTANT OBSERVATIONS:
Mention values that appear outside the reference range given in the report.
Do not diagnose the reason.

DETAILED EXPLANATION:
Explain the report in simple language.

MEDICAL DISCLAIMER:
This explanation is for educational purposes only and is not a medical diagnosis.

MEDICAL REPORT:
${report}
`;

    const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
        API_KEY;

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        try {
            console.log(`Gemini request attempt ${attempt}/${maxRetries}`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                })
            });

            // Success
            if (response.ok) {
                const data = await response.json();

                const generatedText =
                    data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!generatedText) {
                    throw new Error(
                        "No explanation was returned by Gemini."
                    );
                }

                return generatedText;
            }

            // Get error details
            const errorText = await response.text();

            // Retry only for temporary server errors
            if (response.status === 503) {

                console.warn(
                    `Gemini is busy. Retry ${attempt}/${maxRetries}`
                );

                // If this was the last attempt, stop
                if (attempt === maxRetries) {
                    throw new Error(
                        "Gemini is temporarily unavailable after 3 attempts. Please wait a minute and try again."
                    );
                }

                // Wait before retrying
                const waitTime = attempt * 3000;

                console.log(
                    `Waiting ${waitTime / 1000} seconds before retry...`
                );

                await new Promise(resolve =>
                    setTimeout(resolve, waitTime)
                );

                continue;
            }

            // Other errors should NOT be retried
            throw new Error(
                "Gemini API Error: " + errorText
            );

        } catch (error) {

            // Network errors can also be retried
            if (
                attempt < maxRetries &&
                (
                    error.name === "TypeError" ||
                    error.message.toLowerCase().includes("network")
                )
            ) {

                console.warn(
                    `Network error. Retrying ${attempt}/${maxRetries}`
                );

                const waitTime = attempt * 3000;

                await new Promise(resolve =>
                    setTimeout(resolve, waitTime)
                );

                continue;
            }

            throw error;
        }
    }

    throw new Error(
        "Unable to connect to Gemini."
    );
}


// =====================================================
// DISPLAY RESULTS
// =====================================================

function displayResults(text) {

    resultsSection.classList.remove("hidden");

    const sections = parseAIResponse(text);

    summary.innerText =
        sections.summary ||
        "No summary available.";

    observations.innerText =
        sections.observations ||
        "No observations available.";

    fullExplanation.innerText =
        sections.explanation ||
        text;

    createTestCards(
        sections.testResults
    );

    resultsSection.scrollIntoView({
        behavior: "smooth"
    });
}


// =====================================================
// PARSE AI RESPONSE
// =====================================================

function parseAIResponse(text) {

    const result = {

        summary: "",
        testResults: "",
        observations: "",
        explanation: ""
    };

    const summaryMatch = text.match(
        /SUMMARY:\s*([\s\S]*?)(?=TEST RESULTS:|$)/i
    );

    const testMatch = text.match(
        /TEST RESULTS:\s*([\s\S]*?)(?=IMPORTANT OBSERVATIONS:|$)/i
    );

    const observationMatch = text.match(
        /IMPORTANT OBSERVATIONS:\s*([\s\S]*?)(?=DETAILED EXPLANATION:|$)/i
    );

    const explanationMatch = text.match(
        /DETAILED EXPLANATION:\s*([\s\S]*?)(?=MEDICAL DISCLAIMER:|$)/i
    );

    result.summary =
        summaryMatch
            ? summaryMatch[1].trim()
            : "";

    result.testResults =
        testMatch
            ? testMatch[1].trim()
            : "";

    result.observations =
        observationMatch
            ? observationMatch[1].trim()
            : "";

    result.explanation =
        explanationMatch
            ? explanationMatch[1].trim()
            : text;

    return result;
}


// =====================================================
// CREATE TEST CARDS
// =====================================================

function createTestCards(text) {

    testResults.innerHTML = "";

    if (!text) {

        testResults.innerHTML =
            "<p>No structured test results found.</p>";

        return;
    }

    const blocks = text.split(/\n\s*\n/);

    let cardsCreated = 0;

    blocks.forEach(block => {

        const testName =
            getField(block, "Test Name");

        const value =
            getField(block, "Value");

        const unit =
            getField(block, "Unit");

        const range =
            getField(block, "Reference Range");

        const status =
            getField(block, "Status");

        const explanation =
            getField(
                block,
                "Simple Explanation"
            );

        if (!testName && !value) {
            return;
        }

        const card =
            document.createElement("div");

        card.className = "test-card";

        const statusClass =
            getStatusClass(status);

        card.innerHTML = `
            <h4>
                ${escapeHTML(
                    testName || "Test"
                )}
            </h4>

            <div class="test-value">
                ${escapeHTML(
                    value || "Not available"
                )}
                ${escapeHTML(
                    unit || ""
                )}
            </div>

            <div class="test-range">
                Reference Range:
                ${escapeHTML(
                    range || "Not provided"
                )}
            </div>

            <span class="status ${statusClass}">
                ${escapeHTML(
                    status || "Unknown"
                )}
            </span>

            <p style="margin-top:12px;color:#64748b;font-size:14px;">
                ${escapeHTML(
                    explanation ||
                    "No explanation available."
                )}
            </p>
        `;

        testResults.appendChild(card);

        cardsCreated++;
    });

    if (cardsCreated === 0) {

        testResults.innerHTML = `
            <p>
                The AI explanation is available above,
                but individual test values could not be
                separated into cards.
            </p>
        `;
    }
}


// =====================================================
// GET FIELD
// =====================================================

function getField(text, fieldName) {

    const regex = new RegExp(
        fieldName + "\\s*:\\s*(.*)",
        "i"
    );

    const match =
        text.match(regex);

    return match
        ? match[1].trim()
        : "";
}


// =====================================================
// STATUS CLASS
// =====================================================

function getStatusClass(status) {

    if (!status) {
        return "unknown";
    }

    const value =
        status.toLowerCase();

    if (
        value.includes("normal") ||
        value.includes("within")
    ) {

        return "normal";
    }

    if (
        value.includes("high") ||
        value.includes("above")
    ) {

        return "high";
    }

    if (
        value.includes("low") ||
        value.includes("below")
    ) {

        return "low";
    }

    return "unknown";
}


// =====================================================
// ASK QUESTION
// =====================================================

async function askQuestion() {

    const question =
        questionInput.value.trim();

    if (!question) {

        alert(
            "Please enter a question."
        );

        return;
    }

    if (!currentReport) {

        alert(
            "Please analyze a report before asking questions."
        );

        return;
    }

    if (
        API_KEY === "" ||
        API_KEY === "YOUR_GEMINI_API_KEY"
    ) {

        alert(
            "Please add your Gemini API key inside script.js."
        );

        return;
    }

    questionAnswer.classList.remove(
        "hidden"
    );

    questionAnswer.innerText =
        "Thinking...";

    try {

        const selectedLanguage =
            language.value;

        const prompt = `
Answer the user's question using ONLY the medical report below.

Do not diagnose.
Do not prescribe medicines.
Do not invent information.

Explain the answer in simple language.

Language:
${selectedLanguage}

Medical Report:
${currentReport}

User Question:
${question}
`;

        const answer =
            await sendQuestionToGemini(
                prompt
            );

        questionAnswer.innerText =
            answer;

    } catch (error) {

        console.error(error);

        questionAnswer.innerText =
            "Unable to answer the question right now.\n\n" +
            error.message;
    }
}


// =====================================================
// SEND QUESTION TO GEMINI
// =====================================================

async function sendQuestionToGemini(prompt) {

    const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
        API_KEY;

    const response =
        await fetch(url, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ]

            })
        });

    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            "Gemini API Error: " +
            errorText
        );
    }

    const data =
        await response.json();

    const answer =
        data?.candidates?.[0]
            ?.content?.parts?.[0]?.text;

    if (!answer) {

        throw new Error(
            "No answer was returned."
        );
    }

    return answer;
}


// =====================================================
// COPY EXPLANATION
// =====================================================

async function copyExplanation() {

    if (!currentExplanation) {

        alert(
            "There is no explanation to copy."
        );

        return;
    }

    try {

        await navigator.clipboard.writeText(
            currentExplanation
        );

        alert(
            "Explanation copied!"
        );

    } catch (error) {

        alert(
            "Could not copy the explanation."
        );
    }
}


// =====================================================
// DOWNLOAD EXPLANATION
// =====================================================

function downloadExplanation() {

    if (!currentExplanation) {

        alert(
            "There is no explanation to download."
        );

        return;
    }

    const blob =
        new Blob(
            [currentExplanation],
            {
                type: "text/plain"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "medical-report-explanation.txt";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}


// =====================================================
// CLEAR REPORT
// =====================================================

function clearReport() {

    reportText.value = "";

    pdfInput.value = "";

    fileName.textContent = "";

    currentReport = "";

    currentExplanation = "";

    summary.innerText =
        "Your report summary will appear here.";

    observations.innerText =
        "No observations available yet.";

    fullExplanation.innerText =
        "Detailed explanation will appear here.";

    testResults.innerHTML = "";

    questionInput.value = "";

    questionAnswer.innerText = "";

    questionAnswer.classList.add(
        "hidden"
    );

    resultsSection.classList.add(
        "hidden"
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// =====================================================
// LOADING FUNCTIONS
// =====================================================

function showLoading() {

    loadingSection.classList.remove(
        "hidden"
    );

    resultsSection.classList.add(
        "hidden"
    );

    loadingSection.scrollIntoView({
        behavior: "smooth"
    });
}


function hideLoading() {

    loadingSection.classList.add(
        "hidden"
    );
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// =====================================================
// ENTER KEY FOR QUESTIONS
// =====================================================

questionInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            askQuestion();
        }
    }
);