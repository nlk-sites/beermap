/**
 * beerMapd Controller
 *
 * for state /home (in angularApp.js config)
 * with /partials/home.html
 * 
 */
(function() {
	angular
		.module('beerMap')
		.controller('beerMapd', beerMapd);
	
	beerMapd.$inject = ['$scope', '$http', 'locationFactory', 'GoogleMapApi'.ns()];
	
	function beerMapd($scope, $http, locationFactory, GoogleMapApi){
		$scope.map = {center: {latitude: 32.91, longitude: -117 }, zoom: 10 };
		$scope.options = {};//scrollwheel: false};
		$scope.coordsUpdates = 0;
		$scope.dynamicMoveCtr = 0;
		/**
		 * initial default variables that get set later with locationFactory
		 *
		 */
		$scope.mapclass = '';
		$scope.brewon = false;
		$scope.boundary = {
			minlat: false,
			maxlat: false,
			minlng: false,
			maxlng: false
		};
		
		/**
		 * Get all brewery location markers from the locationFactory
		 *
		 */
		locationFactory.loadAll($scope);
		
		/**
		 *	Get Map Stylesfrom external file [includes/map.styles.js]
		 *
		 *	Should we build in a dynamic style selector? For example, light versus dark app style?
		 */
		$scope.styles = mapStyles;

		/**
		 * HTML5 geolocation sensor
		 *
		 * should this be elsewhere?
		 */
		if(navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function(position) {
				/**
				 * only center to new position if new position is within san diego area, +/- ?
				 * note : not sure if this always fires in the right order?
				 */
				if ( locationFactory.checkBounds( $scope.boundary, position.coords.latitude, position.coords.longitude, true ) ) {
					$scope.map.zoom = 12;
					$scope.map.center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
					$scope.$apply();
					console.log('geoloc : all set');
				} else {
					console.log('geoloc : oob');
				}
			}, function() {
				// geoloc err
				console.log('geoloc : err?');
			});
		} else {
			// no geoloc
			console.log('geoloc : no?');
		}
		
		/**
		 * test reloading data in the locationFactory
		 *
		 */
		$scope.reload = function() {
			console.log('reload?!');
			var reload = locationFactory.loadAll();
			console.log(reload);
		};
	}
	
	function markerClicked( $scope, i ) {
		console.log('clicked #'+ i + ' !');
		var m = $scope.markers[i];
		console.log(m);
		$scope.mapclass = 'slideleft';
		$scope.overlayclass = 'col-md-12 overlay-container';
		$scope.brewon = m;
		$scope.markers.selected = m.id;
		$scope.$apply();
	}
})();