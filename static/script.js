// ======================================================
// AI CAREER GUIDE & RESUME ANALYZER
// ======================================================

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================================
// CAREER GUIDE
// ======================================================

async function generateCareerPlan() {

    const result = document.getElementById("careerResult");

    const name = document.getElementById("name").value.trim();
    const role = document.getElementById("target_role").value.trim();
    const skills = document.getElementById("skills").value.trim();
    const days = Number(document.getElementById("days").value) || 30;
    const hours = Number(document.getElementById("hours").value) || 2;

    if (!name) {
        result.innerHTML = `<div class="error">Please enter your name.</div>`;
        return;
    }

    if (!role) {
        result.innerHTML = `<div class="error">Please enter your target role.</div>`;
        return;
    }

    result.innerHTML = `
        <div class="result-card loading">
            Generating your personalized career plan...
        </div>
    `;

    try {

        const response = await fetch("/api/career", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                target_role: role,
                skills: skills,
                days: days,
                hours: hours
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Career plan generation failed."
            );
        }

        let html = `
            <div class="summary-card">
                <h3>Your Career Roadmap</h3>
                <p>
                    ${escapeHtml(
                        data.summary ||
                        "Your personalized career roadmap."
                    )}
                </p>
            </div>
        `;

        if (data.skill_gaps && data.skill_gaps.length) {

            html += `
                <div class="result-card">
                    <h3>🎯 Skills to Focus On</h3>
                    <div class="skill-tags">
            `;

            data.skill_gaps.forEach(skill => {
                html += `
                    <span class="skill-tag">
                        ${escapeHtml(skill)}
                    </span>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        if (data.plan && data.plan.length) {

            html += `
                <div style="margin:30px 0 15px;">
                    <h3>Your ${data.plan.length}-Day Plan</h3>
                </div>
            `;

            data.plan.forEach(day => {

                html += `
                    <div class="day-card">

                        <div class="day-header">

                            <div class="day-number">
                                ${escapeHtml(day.day)}
                            </div>

                            <div class="day-title">
                                ${escapeHtml(day.topic)}
                            </div>

                            <div class="day-hours">
                                ${escapeHtml(day.hours || "")} hrs
                            </div>

                        </div>
                `;

                if (day.tasks && day.tasks.length) {

                    html += `<ul>`;

                    day.tasks.forEach(task => {
                        html += `
                            <li>
                                ${escapeHtml(task)}
                            </li>
                        `;
                    });

                    html += `</ul>`;
                }

                if (day.resources && day.resources.length) {

                    html += `
                        <div class="resource-list">
                    `;

                    day.resources.forEach(resource => {

                        if (resource.url) {

                            html += `
                                <a
                                    href="${escapeHtml(resource.url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    🔗 ${escapeHtml(
                                        resource.title || "Learn"
                                    )}
                                </a>
                            `;
                        }

                    });

                    html += `</div>`;
                }

                html += `</div>`;
            });
        }

      result.innerHTML = html;

// Version 2 - Skill Gap Analysis
showSkillGap(role, skills);
createProgressTracker(days);

} catch (error) {

        console.error(error);

        result.innerHTML = `
            <div class="error">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}


// ======================================================
// RESUME ANALYZER
// ======================================================

async function analyzeResume() {

    const result = document.getElementById("resumeResult");
    const form = document.getElementById("resumeForm");
    const roleInput = document.getElementById("resumeRole");

    console.log("Analyze Resume clicked");


    if (!form) {
        result.innerHTML = `
            <div class="error">
                Resume form was not found.
            </div>
        `;
        return;
    }


    if (!roleInput) {
        result.innerHTML = `
            <div class="error">
                Target role field was not found.
            </div>
        `;
        return;
    }


    const role = roleInput.value.trim();


    if (!role) {
        result.innerHTML = `
            <div class="error">
                Please enter your target role.
            </div>
        `;
        return;
    }


    // Get everything directly from the form
    const formData = new FormData(form);

    const file = formData.get("resume");


    console.log("Target role:", role);
    console.log("Selected file:", file);


    // Check selected file
    if (
        !file ||
        !(file instanceof File) ||
        !file.name
    ) {

        result.innerHTML = `
            <div class="error">
                Please select your PDF or DOCX resume.
            </div>
        `;

        return;
    }


    // Loading
    result.innerHTML = `
        <div class="result-card loading">
            Analyzing your resume...
            <br>
            <small>Please wait a few seconds.</small>
        </div>
    `;


    try {

        console.log(
            "Sending resume to Flask..."
        );


        const response = await fetch(
            "/api/resume",
            {
                method: "POST",
                body: formData
            }
        );


        console.log(
            "Server response:",
            response.status
        );


        const data = await response.json();


        console.log(
            "Resume result:",
            data
        );


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Resume analysis failed."
            );
        }


        displayResumeResult(data);


    } catch (error) {

        console.error(
            "Resume analysis error:",
            error
        );


        result.innerHTML = `
            <div class="error">

                <strong>
                    Resume analysis failed.
                </strong>

                <br><br>

                ${escapeHtml(error.message)}

            </div>
        `;
    }
}


// ======================================================
// DISPLAY RESUME RESULT
// ======================================================

function displayResumeResult(data) {

    const result =
        document.getElementById("resumeResult");


    const score =
        Number(data.ats_score) || 0;


    let html = `

        <div class="ats-card">

            <div
                class="ats-score"
                style="
                    background:
                    conic-gradient(
                        var(--orange) ${score * 3.6}deg,
                        #eee ${score * 3.6}deg
                    );
                "
            >

                <span>
                    ${score}%
                </span>

            </div>

            <div class="ats-info">

                <h3>
                    ATS Compatibility Score
                </h3>

                <p>
                    Your resume was analyzed for
                    <strong>
                        ${escapeHtml(data.target_role)}
                    </strong>.
                </p>

            </div>

        </div>

    `;


    if (
        data.matched_skills &&
        data.matched_skills.length
    ) {

        html += `
            <div class="result-card">

                <h3>✅ Matching Skills</h3>

                <div class="skill-tags">
        `;

        data.matched_skills.forEach(skill => {

            html += `
                <span class="skill-tag">
                    ${escapeHtml(skill)}
                </span>
            `;

        });

        html += `
                </div>
            </div>
        `;
    }


    if (
        data.missing_skills &&
        data.missing_skills.length
    ) {

        html += `
            <div class="result-card">

                <h3>⚠️ Skills to Consider</h3>

                <div class="skill-tags">
        `;

        data.missing_skills.forEach(skill => {

            html += `
                <span class="skill-tag">
                    ${escapeHtml(skill)}
                </span>
            `;

        });

        html += `
                </div>
            </div>
        `;
    }


    if (
        data.improvements &&
        data.improvements.length
    ) {

        html += `
            <div class="result-card">

                <h3>✨ Resume Improvements</h3>

                <ul>
        `;

        data.improvements.forEach(item => {

            html += `
                <li>
                    ${escapeHtml(item)}
                </li>
            `;

        });

        html += `
                </ul>
            </div>
        `;
    }


    if (
        data.recommended_skills &&
        data.recommended_skills.length
    ) {

        html += `
            <div class="result-card">

                <h3>🚀 Recommended Skills</h3>

                <div class="skill-tags">
        `;

        data.recommended_skills.forEach(skill => {

            html += `
                <span class="skill-tag">
                    ${escapeHtml(skill)}
                </span>
            `;

        });

        html += `
                </div>
            </div>
        `;
    }


    if (
        data.certifications &&
        data.certifications.length
    ) {

        html += `
            <div class="result-card">

                <h3>🎓 Certification Suggestions</h3>

                <ul>
        `;

        data.certifications.forEach(cert => {

            html += `
                <li>
                    ${escapeHtml(cert)}
                </li>
            `;

        });

        html += `
                </ul>
            </div>
        `;
    }


    if (data.summary_suggestion) {

        html += `
            <div class="summary-card">

                <h3>
                    📝 Suggested Professional Summary
                </h3>

                <p>
                    ${escapeHtml(
                        data.summary_suggestion
                    )}
                </p>

            </div>
        `;
    }


    if (data.job_search_advice) {

        html += `
            <div class="result-card">

                <h3>
                    💼 Job Search Advice
                </h3>

                <p>
                    ${escapeHtml(
                        data.job_search_advice
                    )}
                </p>

            </div>
        `;
    }


    if (
        data.job_portals &&
        data.job_portals.length
    ) {

        html += `
            <div class="result-card">

                <h3>
                    🔎 Job Portals
                </h3>

                <div class="resource-list">
        `;

        data.job_portals.forEach(portal => {

            html += `
                <a
                    href="${escapeHtml(portal.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    ${escapeHtml(portal.name)}
                </a>
            `;

        });

        html += `
                </div>
            </div>
        `;
    }


    result.innerHTML = html;
}


// ======================================================
// FILE NAME
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const input =
            document.getElementById("resume");

        const name =
            document.getElementById("resumeFileName");


        if (input) {

            input.addEventListener(
                "change",
                function () {

                    if (
                        this.files &&
                        this.files.length > 0
                    ) {

                        if (name) {

                            name.textContent =
                                this.files[0].name;

                        }

                        console.log(
                            "Selected:",
                            this.files[0].name
                        );
                    }

                }
            );
        }

    }
);
// ===============================
// SKILL GAP ANALYSIS - VERSION 2
// ===============================

function showSkillGap(targetRole, currentSkills) {
    const result = document.getElementById("skillGapResult");

    if (!result) return;

    const role = targetRole.toLowerCase();

    const roleSkills = {
        "data analyst": [
            "SQL",
            "Excel",
            "Power BI",
            "Statistics",
            "Data Visualization",
            "Python"
        ],
        "hr": [
            "Communication",
            "Excel",
            "Recruitment",
            "Interviewing",
            "HR Management",
            "MS Office"
        ],
        "software developer": [
            "Programming",
            "Git",
            "Data Structures",
            "APIs",
            "Databases",
            "Problem Solving"
        ],
        "web developer": [
            "HTML",
            "CSS",
            "JavaScript",
            "Git",
            "APIs",
            "Responsive Design"
        ],
        "cybersecurity": [
            "Networking",
            "Linux",
            "Cybersecurity Basics",
            "Python",
            "Cryptography",
            "Security Tools"
        ]
    };

    let requiredSkills = roleSkills["data analyst"];

    for (const key in roleSkills) {
        if (role.includes(key)) {
            requiredSkills = roleSkills[key];
            break;
        }
    }

    const skillsText = currentSkills.toLowerCase();

    const matched = requiredSkills.filter(skill =>
        skillsText.includes(skill.toLowerCase())
    );

    const missing = requiredSkills.filter(skill =>
        !skillsText.includes(skill.toLowerCase())
    );

    result.innerHTML = `
        <div class="skill-gap-card">
            <h2>🎯 Skill Gap Analysis</h2>

            <div class="skill-columns">
                <div>
                    <h3>✓ Your Skills</h3>
                    ${
                        matched.length
                        ? matched.map(skill => `<span class="skill-tag matched">${skill}</span>`).join("")
                        : "<p>No matching skills found yet.</p>"
                    }
                </div>

                <div>
                    <h3>○ Skills to Learn</h3>
                    ${
                        missing.length
                        ? missing.map(skill => `<span class="skill-tag missing">${skill}</span>`).join("")
                        : "<p>Great! You have covered the main skills.</p>"
                    }
                </div>
            </div>
        </div>
    `;
}
// ======================================================
// AI INTERVIEW QUESTION GENERATOR - VERSION 2
// ======================================================

async function generateInterviewQuestions() {

    const result = document.getElementById("interviewResult");

    if (!result) return;

    const roleInput = document.getElementById("target_role");
    const skillsInput = document.getElementById("skills");

    const role = roleInput ? roleInput.value.trim() : "";
    const skills = skillsInput ? skillsInput.value.trim() : "";

    if (!role) {
        result.innerHTML = `
            <div class="error">
                Please enter your target role first.
            </div>
        `;
        return;
    }

    result.innerHTML = `
        <div class="result-card loading">
            Generating interview questions...
        </div>
    `;

    try {

        const response = await fetch("/api/interview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                target_role: role,
                skills: skills
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Could not generate questions."
            );
        }

        let html = `
            <div class="interview-card">
                <h2>🎤 Interview Preparation</h2>
                <p>
                    Practice these questions for your
                    <strong>${escapeHtml(role)}</strong> role.
                </p>
        `;

        data.questions.forEach((item, index) => {

            html += `
                <div class="interview-question">
                    <h3>
                        ${index + 1}. ${escapeHtml(item.question)}
                    </h3>

                    <div class="interview-answer">
                        <strong>Sample Answer:</strong>
                        <p>${escapeHtml(item.answer)}</p>
                    </div>
                </div>
            `;
        });

        html += `</div>`;

        result.innerHTML = html;

    } catch (error) {

        console.error(
            "Interview generation error:",
            error
        );

        result.innerHTML = `
            <div class="error">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}
// ======================================================
// 30-DAY PROGRESS TRACKER - VERSION 2
// ======================================================

function createProgressTracker(days = 30) {

    const container = document.getElementById("progressTracker");

    if (!container) return;

    let completed = JSON.parse(
        localStorage.getItem("careerProgress") || "[]"
    );

    function renderTracker() {

        const completedCount = completed.length;
        const percentage = Math.round(
            (completedCount / days) * 100
        );

        let html = `
            <div class="progress-card">

                <h2>📊 Your Career Progress</h2>

                <div class="progress-info">
                    <strong>${completedCount}/${days} Days Completed</strong>
                    <strong>${percentage}%</strong>
                </div>

                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width: ${percentage}%"
                    ></div>
                </div>

                <div class="progress-days">
        `;

        for (let day = 1; day <= days; day++) {

            const checked = completed.includes(day);

            html += `
                <label class="progress-day">
                    <input
                        type="checkbox"
                        ${checked ? "checked" : ""}
                        onchange="toggleProgress(${day}, ${days})"
                    >

                    <span>
                        Day ${day}
                    </span>
                </label>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    window.toggleProgress = function(day, totalDays) {

        if (completed.includes(day)) {

            completed = completed.filter(
                item => item !== day
            );

        } else {

            completed.push(day);
        }

        localStorage.setItem(
            "careerProgress",
            JSON.stringify(completed)
        );

        renderTracker();
    };

    renderTracker();
}