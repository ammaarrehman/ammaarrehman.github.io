/* skills section: vanilla tabs. "::label" entries render as group labels. */
(function () {
  var root = document.getElementById("skills-app");
  if (!root) return;
  var groups = {
    cloud_infra: ["::certified", "AWS Cloud Practitioner (CLF-C02)", "::services", "S3", "CloudFront", "Route 53", "IAM", "EC2", "::as code", "Terraform", "Docker", "Infrastructure as code"],
    security_grc: ["::frameworks", "NIST Cybersecurity Framework", "CIS Controls (CIS 18)", "Ready5 / Discover5", "::practice", "Cyber readiness assessment support", "Capability gap analysis", "Findings documentation", "::controls", "EDR / MDR", "MFA & Conditional Access", "SPF / DKIM / DMARC", "DNS filtering", "Backup & restore testing"],
    systems_networking: ["::certified", "CompTIA Tech+", "::stack", "Linux", "DNS / DNSSEC", "Unbound", "AdGuard Home", "keepalived / VRRP", "Tailscale", "Networking fundamentals"],
    monitoring: ["Prometheus", "Grafana", "Uptime Kuma", "node-exporter", "cAdvisor"],
    programming: ["Python (evals, tooling)", "JavaScript (this site)", "HTML / CSS (in production)", "Java (basics)", "Git / GitHub", "VS Code"],
    ai_automation: ["Claude & the Anthropic API", "AWS Kiro", "AI-assisted development", "Prompt design", "Evaluating & refining AI outputs", "Technical documentation"]
  };
  var tabs = root.querySelector(".stack-tabs");
  var chips = root.querySelector(".stack-chips");
  var label = root.querySelector(".stack-active");
  var buttons = [];

  function show(name) {
    buttons.forEach(function (b) {
      var on = b.textContent === name;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    label.textContent = name;
    chips.innerHTML = "";
    groups[name].forEach(function (item, i) {
      var s = document.createElement("span");
      if (item.indexOf("::") === 0) { s.className = "grp"; s.textContent = item.slice(2); }
      else s.textContent = item;
      s.style.setProperty("--i", i);
      chips.appendChild(s);
    });
  }

  Object.keys(groups).forEach(function (name) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = name;
    b.addEventListener("click", function () { show(name); });
    tabs.appendChild(b);
    buttons.push(b);
  });

  tabs.addEventListener("keydown", function (e) {
    var i = buttons.indexOf(document.activeElement);
    if (i < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    var n = buttons[(i + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length];
    n.focus(); n.click(); e.preventDefault();
  });

  show("cloud_infra");
})();
