/* skills section — Vue 3 app (matches resume v5) */
(function () {
  if (!window.Vue) return;
  var groups = {
    cloud_infra: ["::certified", "AWS Cloud Practitioner (CLF-C02)", "::services", "S3", "CloudFront", "Route 53", "IAM", "EC2", "::as code", "Terraform", "Docker", "Infrastructure as code"],
    systems_networking: ["Linux", "DNS / DNSSEC", "Unbound", "AdGuard Home", "keepalived / VRRP", "Tailscale", "Networking fundamentals"],
    monitoring: ["Prometheus", "Grafana", "Uptime Kuma", "node-exporter", "cAdvisor"],
    programming: ["Python — evals, tooling", "JavaScript — this site", "HTML / CSS — in production", "Java — basics", "Git / GitHub", "VS Code"],
    ai_automation: ["Claude & the Anthropic API", "AWS Kiro", "AI-assisted development", "Prompt design", "Evaluating & refining AI outputs", "Technical documentation"]
  };
  Vue.createApp({
    data: function () { return { cats: Object.keys(groups), active: "cloud_infra", groups: groups }; }
  }).mount("#skills-app");
})();
