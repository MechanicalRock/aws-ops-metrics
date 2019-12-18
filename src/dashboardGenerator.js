'use strict';


const ANNOTATION_ELITE_COLOUR = '#98df8a';
const ANNOTATION_HIGH_COLOUR = '#ffbb78';
const ANNOTATION_MEDIUM_COLOUR = '#d62728';
const MEAN_COLOUR = '#2ca02c';

const WIDGET_HEIGHT = 6;
const WIDGET_WIDTH = 8;


// Create a dashboard containing multiple widgets, each based from a consistent template
// The properties here map the metrics to a readable label
// unit conversion is used to convert from seconds to a more meaningful unit, based on the metric.
const MINUTES = {
  unit: 60,
  label: 'minutes'
};

const HOURS = {
  unit: 60 * 60,
  label: 'hours'
};

const DAYS = {
  unit: 60 * 60 * 24,
  label: 'days'
};

const ONE_DAYS = 60 * 60 * 24;
const SEVEN_DAYS = 60 * 60 * 24 * 7;

const applyLimits = (state) => {
  // See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html
  const maxMetricsPerWidget = 100;
  const maxMetricsPerServiceInAWidget = 2;
  const maxServices = Math.floor(maxMetricsPerWidget / maxMetricsPerServiceInAWidget);

  // For each service there will be three metrics (MTTR, MTBF, MTTF)
  const maxSupportedMetrics = maxServices * 3;

  if (state.metrics.length > maxSupportedMetrics) {
    console.warn(`Maximum of ${maxSupportedMetrics} metrics are allowed in a single dashboard. Some metrics will not be reported.`);
    state.metrics = state.metrics.sort((a, b) => (a.serviceName > b.serviceName) ? 1 : -1);
    state.metrics = state.metrics.slice(0, maxSupportedMetrics);
    state.expectTruncated = true;
    state.yOffset = 2;
  }
};

function flattenNestedArray(array) {
  return [].concat.apply([], array);
}

function trendWidgets(metrics, y, state) {

  return state.widgetMappings.map(mapping => {
    const region = state.region;
    const filterredGroup = metrics.filter(x => x.metricName == mapping.label);
    let resultMetrics = filterredGroup.map((mappinggroup, index) => {
      return [
        [
          {
            "expression": `FILL(m${index}/${mapping.unitConversion.unit},AVG(m${index}/${mapping.unitConversion.unit}))`,
            "id": `e${index}`,
            "region": "ap-southeast-2",
            "label": mappinggroup.serviceName
          }
        ],
        [
          "Operations",
          mapping.label,
          "service",
          mappinggroup.serviceName,
          {
            "stat": "Average",
            "id": `m${index}`,
            "visible": false,
            "period": SEVEN_DAYS
          }
        ]
      ]
    });
    //flatten the arrays
    resultMetrics = flattenNestedArray(resultMetrics);

    return {
      "type": "metric",
      "x": mapping.x,
      "y": y,
      "width": WIDGET_WIDTH,
      "height": WIDGET_HEIGHT,
      "properties": {
        "metrics": resultMetrics,
        "view": "timeSeries",
        "region": region,
        "title": mapping.label + ' Trend',
        "period": ONE_DAYS,
        "stacked": false,
        "yAxis": {
          "left": {
            "min": 0,
            "label": mapping.unitConversion.label,
            "showUnits": false
          },
          "right": {
            "showUnits": true
          }
        },
        "annotations": mapping.properties.annotations,
        "stat": "Sum"
      }
    };
  });

}

function averageWidgets(metrics, y, state) {

  return state.widgetMappings.map(mapping => {

    const filteredGroup = metrics.filter(x => x.metricName == mapping.label);
    let resultMetrics = filteredGroup.map((mappingGroup, index) => {
      return [
        "Operations",
        mappingGroup.metricName,
        "service",
        mappingGroup.serviceName,
        {
          "id": `m${index}`,
          "label": mappingGroup.serviceName
        }
      ]
    });
    return {
      "type": "metric",
      "x": mapping.x,
      "y": y,
      "width": WIDGET_WIDTH,
      "height": WIDGET_HEIGHT,
      "properties": {
        "metrics": resultMetrics,
        "view": "singleValue",
        "region": state.region,
        "stat": "Average",
        "period": SEVEN_DAYS,
        "title": `${mapping.label} Average (7d)`
      }
    }
  });

}

class DashboardTrendGenerator {
  run(eventPromise) {
    return eventPromise
      .then(this.initializeState)
      .then(this.getMetrics)
      .then(this.putDashboard);
  }


  initializeState(state) {
    state.metrics = [];
    state.yOffset = 0;
    state.widgetMappings = [
      {
        "x": 0,
        "unitConversion": HOURS,
        "label": "MTTR",
        "properties": {
          "annotations": {
            "horizontal": [
              {
                "color": ANNOTATION_ELITE_COLOUR,
                "label": "< 1 hours",
                "value": 1,
                "fill": "below"
              },
              [
                {
                  "color": ANNOTATION_HIGH_COLOUR,
                  "label": "> 1 hours",
                  "value": 1
                },
                {
                  "value": 12,
                  "label": "< 0.5 day"
                }
              ],
              {
                "color": ANNOTATION_MEDIUM_COLOUR,
                "label": "> 0.5 day",
                "value": 12,
                "fill": "above"
              }
            ]
          }
        }
      },
      {
        "x": 8,
        "unitConversion": DAYS,
        "label": "MTBF",
        "properties": {
          "annotations": {
            "horizontal": [
              {
                "color": ANNOTATION_ELITE_COLOUR,
                "label": "> 1 week",
                "value": 7,
                "fill": "above"
              },
              [
                {
                  "color": ANNOTATION_HIGH_COLOUR,
                  "label": "< 1 week",
                  "value": 7
                },
                {
                  "value": 1,
                  "label": "1 day"
                }
              ],
              {
                "color": ANNOTATION_MEDIUM_COLOUR,
                "label": "< 1 day",
                "value": 1,
                "fill": "below"
              }
            ]
          }
        }
      },
      {
        "x": 16,
        "unitConversion": DAYS,
        "label": "MTTF",
        "properties": {
          "annotations": {
            "horizontal": [
              {
                "color": ANNOTATION_ELITE_COLOUR,
                "label": "> 1 week",
                "value": 7,
                "fill": "above"
              },
              [
                {
                  "color": ANNOTATION_HIGH_COLOUR,
                  "label": "< 1 week",
                  "value": 7
                },
                {
                  "value": 1,
                  "label": "1 day"
                }
              ],
              {
                "color": ANNOTATION_MEDIUM_COLOUR,
                "label": "< 1 day",
                "value": 1,
                "fill": "below"
              }
            ]
          }
        }
      }
    ];

    return state;
  }

  getMetrics(state) {
    return new Promise(function (resolve, reject) {
      state.cloudwatch.listMetrics({ "Namespace": "Operations" }).eachPage(function (err, data) {
        if (err) {
          reject(err);
          return;
        }

        if (data === null) {
          resolve(state);
        } else {

          state.metrics =
            data.Metrics.map(metric => metric.Dimensions.filter(dimension => dimension.Name === 'service').map(dimension => { return { serviceName: dimension.Value, metricName: metric.MetricName } }))
              .reduce((a, b) => a.concat(b), state.metrics);
        }
      });

    });
  }


  putDashboard(state) {
    state.metrics = [...new Set(state.metrics)].sort();

    applyLimits(state);

    let y = state.yOffset; // leave space for the legend on first row

    let dashboard = {
      "start": "-P42D",
      "widgets": [],
    };

    const TEXT_HEIGHT = 4;
    let x = 0;
    let textArray = [
      {
        "title": "MTTR",
        "description":
          "Mean time to recovery.  **Lower = better**\n\n" +
          "When a failure occurs, how quickly is service restored.\n\n" +
          "When the system fails, the team should \"stop the line\" and swarm to fix it.\n"
      },
      {
        "title": "MTBF",
        "description":
          "Mean time between failures.  **Higher = better**\n\n" +
          "MTBF describes system stability.  How often does the service fail.\n\n" +
          "An unstable system suggests systemic quality/resiliency issues that needs to be addressed.\n"
      },
      {
        "title": "MTTF",
        "description":
          "Mean time to failure.  **Higher = better**\n\n" +
          "How stable/available is the system.\n\n" +
          "A low MTTF indicates that the system if often unavailable.\n\n" +
          "Improve availability by improving system resiliency.  Reduce planned outages using staged deployment, such as blue/green or canary releasing.\n"
      }
    ];

    textArray.forEach(text => {
      dashboard.widgets.push({
        "type": "text",
        "x": x,
        "y": y,
        "width": 8,
        "height": TEXT_HEIGHT,
        "properties": {
          "markdown": `\n### ${text.title}\n${text.description}`
        }
      });

      x += 8;
    });

    if (state.expectTruncated) {
      dashboard.widgets.push({
        "type": "text",
        "x": 0,
        "y": 0,
        "width": 24,
        "height": state.yOffset,
        "properties": {
          "markdown": `\n### Warning\nMaximum number of allowed metrics in a single dashboard is reached. Some metrics will not be reported.`
        }
      });
    }
    y += TEXT_HEIGHT;

    const tWidgets = trendWidgets(state.metrics, y, state);
    dashboard.widgets.push(tWidgets);

    y += WIDGET_HEIGHT;
    const aWidgets = averageWidgets(state.metrics, y, state);
    dashboard.widgets.push(aWidgets);

    // flatten the nested arrays
    dashboard.widgets = flattenNestedArray(dashboard.widgets);

    return state.cloudwatch.putDashboard({
      'DashboardName': 'AvailabilityTrends-' + state.region,
      'DashboardBody': JSON.stringify(dashboard)
    }).promise();
  }
}

module.exports = DashboardTrendGenerator;
