/**
 * SYED MOHSIN - DEVOPS ENGINEER PORTFOLIO APP
 * Handles the interactive terminal simulator, command parser, and UI bindings.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ==========================================================================
       1. INTERACTIVE TERMINAL SIMULATOR
       ========================================================================== */
    
    const terminalContainer = document.querySelector('.terminal-container');
    const terminalBody = document.getElementById('terminal-body');
    const hiddenInput = document.getElementById('terminal-hidden-input');
    const inputDisplay = document.getElementById('input-display');
    
    // Commands Database
    const commands = {
        help: () => [
            'Available commands:',
            '  <span class="cmd-highlight">about</span>      - Print professional biography',
            '  <span class="cmd-highlight">skills</span>     - List core technical competencies',
            '  <span class="cmd-highlight">projects</span>   - Display automated DevOps projects',
            '  <span class="cmd-highlight">contact</span>    - Show contact channels',
            '  <span class="cmd-highlight">clear</span>      - Clear terminal screen'
        ],
        about: () => [
            'Biography:',
            '  I am a DevOps Specialist and Cloud Infrastructure Engineer.',
            '  I design, script, and manage automated delivery systems (CI/CD),',
            '  orchestrate container structures (Kubernetes), and configure',
            '  scalable environments via Infrastructure-as-Code (Terraform).'
        ],
        skills: () => [
            'Technical Competencies:',
            '  <span class="cmd-highlight">[CI/CD]</span>        Jenkins, GitHub Actions, GitLab CI, ArgoCD',
            '  <span class="cmd-highlight">[Containers]</span>   Docker, Kubernetes (K8s), Helm, Istio',
            '  <span class="cmd-highlight">[IaC]</span>          Terraform, Ansible, CloudFormation',
            '  <span class="cmd-highlight">[Cloud]</span>        AWS, Microsoft Azure, GCP',
            '  <span class="cmd-highlight">[Monitoring]</span>   Prometheus, Grafana, ELK Stack, Loki',
            '  <span class="cmd-highlight">[Scripting]</span>    Bash, Python, JavaScript, Go'
        ],
        projects: () => [
            'DevOps Projects:',
            '  <span class="cmd-highlight">1. NebulaSynth CI/CD Pipeline</span>',
            '     - Containerized Jenkins CI server with docker-in-docker socket support.',
            '     - Complete Pipeline-as-Code automation with Nginx hosting.',
            '  <span class="cmd-highlight">2. Multi-Master Kubernetes AWS Setup</span>',
            '     - Provisioned cluster nodes in private VPC subnets via Terraform.',
            '     - Automated configuration bootstrapping with Ansible roles.',
            '  <span class="cmd-highlight">3. GitOps Continuous Delivery Setup</span>',
            '     - Configured ArgoCD syncing charts to Amazon EKS clusters.'
        ],
        contact: () => [
            'Contact Information:',
            '  - Email:    syed.mohsin@example.com',
            '  - GitHub:   github.com/syedmohsin09',
            '  - LinkedIn: linkedin.com/in/syedmohsin'
        ]
    };

    // Focus hidden input on terminal click
    terminalContainer.addEventListener('click', () => {
        hiddenInput.focus();
    });

    // Update screen display on typing
    hiddenInput.addEventListener('input', () => {
        inputDisplay.textContent = hiddenInput.value;
    });

    // Handle command submission
    hiddenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const inputVal = hiddenInput.value.trim().toLowerCase();
            hiddenInput.value = '';
            inputDisplay.textContent = '';
            
            // Execute command
            processCommand(inputVal);
        }
    });

    function processCommand(cmd) {
        if (cmd === '') {
            appendCommandLine('');
            return;
        }

        // 1. Log the entered command
        appendCommandLine(cmd);

        // 2. Parse command output
        if (cmd === 'clear') {
            terminalBody.innerHTML = '';
            appendPromptArea();
            return;
        }

        if (commands[cmd]) {
            const outputLines = commands[cmd]();
            outputLines.forEach(line => appendOutputLine(line));
        } else {
            appendOutputLine(`bash: command not found: ${cmd}. Type <span class="cmd-highlight">help</span> to view commands.`);
        }

        // Add spacing & prompt again
        appendOutputLine('<br>');
        appendPromptArea();
    }

    function appendCommandLine(text) {
        // Find existing prompt area and replace with solid command
        const promptLines = terminalBody.querySelectorAll('.terminal-prompt-line');
        const activePrompt = promptLines[promptLines.length - 1];
        
        if (activePrompt) {
            activePrompt.innerHTML = `
                <span class="prompt-user">syed@mohsin-devops</span>:<span class="prompt-dir">~</span>$ <span>${text}</span>
            `;
        }
    }

    function appendOutputLine(htmlContent) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = htmlContent;
        terminalBody.appendChild(line);
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    function appendPromptArea() {
        const promptLine = document.createElement('div');
        promptLine.className = 'terminal-prompt-line';
        promptLine.innerHTML = `
            <span class="prompt-user">syed@mohsin-devops</span>:<span class="prompt-dir">~</span>$ <span class="input-display" id="input-display"></span><span class="terminal-cursor"></span>
        `;
        
        terminalBody.appendChild(promptLine);
        
        // Re-bind current input displays
        const displays = terminalBody.querySelectorAll('#input-display');
        const activeDisplay = displays[displays.length - 1];
        
        // Re-route typing to update the active line display
        hiddenInput.oninput = () => {
            activeDisplay.textContent = hiddenInput.value;
        };
        
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    // Initialize cursor typing focus
    hiddenInput.focus();

    /* ==========================================================================
       2. SMOOTH SCROLL & NAVIGATION GLOWS
       ========================================================================== */
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');

    window.addEventListener('scroll', () => {
        let currentSection = '';
        
        sections.forEach(sec => {
            const secTop = sec.offsetTop;
            const secHeight = sec.clientHeight;
            if (window.scrollY >= secTop - 120) {
                currentSection = sec.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });
});
