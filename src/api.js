var hat = require('hat');
var featuresAt = require('./lib/features_at');
var geojsonhint = require('geojsonhint');

var featureTypes = {
  'Polygon': require('./feature_types/polygon'),
  'LineString': require('./feature_types/line_string'),
  'Point': require('./feature_types/point')
};

module.exports = function(ctx) {

  return {
    getFeatureIdsAt: function(x, y) {
      var features = featuresAt({point: {x, y}}, ctx);
      return features.map(feature => feature.properties.id);
    },
    add: function (geojson, validateGeoJSON=true) {

       if (geojson.type !== 'FeatureCollection' && !geojson.geometry) {
        geojson = {
          type: 'Feature',
          id: geojson.id,
          properties: geojson.properties || {},
          geometry: geojson
        };
      }

      if (validateGeoJSON) {
        var errors = geojsonhint.hint(geojson);
        if (errors.length) {
          throw new Error(errors[0].message);
        }

        (geojson.type === 'FeatureCollection' ? geojson.features : [geojson]).forEach(feature => {
          if (featureTypes[feature.geometry.type] === undefined) {
            throw new Error('Invalid feature type. Must be Point, Polygon or LineString');
          }
        });
      }

      if (geojson.type === 'FeatureCollection') {
        return geojson.features.map(feature => this.add(feature, false));
      }

      geojson = JSON.parse(JSON.stringify(geojson));

      geojson.id = geojson.id || hat();
      if (ctx.store.needsUpdate(geojson)) {
        var model = featureTypes[geojson.geometry.type];

        let internalFeature = new model(ctx, geojson);
        ctx.store.add(internalFeature);
        ctx.store.render();
      }
      else {
        let internalFeature = ctx.store.get(geojson.id);
        internalFeature.properties = geojson.properties;
      }
      return geojson.id;
    },
    get: function (id) {
      var feature = ctx.store.get(id);
      if (feature) {
        return feature.toGeoJSON();
      }
    },
    getAll: function() {
      return {
        type: 'FeatureCollection',
        features: ctx.store.getAll().map(feature => feature.toGeoJSON())
      };
    },
    delete: function(id) {
      ctx.store.delete([id]);
      ctx.store.render();
    },
    deleteAll: function() {
      ctx.store.delete(ctx.store.getAll().map(feature => feature.id));
      ctx.store.render();
    },
    changeMode: function(mode, opts) {
      ctx.events.changeMode(mode, opts);
    },
    trash: function() {
      ctx.events.fire('trash');
    }
  };
};
