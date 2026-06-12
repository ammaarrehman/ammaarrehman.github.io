/* skills section — Vue 3 app (matches resume v2) */
(function () {
  if (!window.Vue) return;
  var groups = {
    cloud: ["::certified", "AWS Cloud Practitioner (CLF-C02)", "::services", "S3", "CloudFront", "Route 53", "IAM", "EC2 fundamentals"],
    programming: ["Python — data structures, file I/O", "JavaScript — this site", "HTML / CSS — in production", "Java — basics"],
    it_foundations: ["Troubleshooting", "Hardware fundamentals", "Networking basics", "Security basics", "Data analysis"],
    platforms: ["Git / GitHub", "Microsoft Excel", "WordPress", "Shopify", "Inventory / POS systems"]
  };
  Vue.createApp({
    data: function () { return { cats: Object.keys(groups), active: "cloud", groups: groups }; }
  }).mount("#skills-app");
})();
