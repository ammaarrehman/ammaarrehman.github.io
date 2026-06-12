/* skills section — Vue 3 app */
(function () {
  if (!window.Vue) return;
  var groups = {
    programming: ["Python — data structures, file I/O", "HTML / CSS — in production", "JavaScript — this site", "Java — basics", "SQL — learning"],
    cloud: ["::certified", "AWS Cloud Practitioner", "::services", "S3", "CloudFront", "Route 53", "IAM", "EC2 basics"],
    it_support: ["Hardware", "Networking fundamentals", "Troubleshooting", "Security basics", "Ticketing & documentation"],
    platforms: ["Excel", "Git / GitHub", "WordPress", "Shopify", "POS & inventory systems", "Linux basics"]
  };
  Vue.createApp({
    data: function () { return { cats: Object.keys(groups), active: "programming", groups: groups }; }
  }).mount("#skills-app");
})();
