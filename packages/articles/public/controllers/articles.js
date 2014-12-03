'use strict';

angular.module('mean.articles').controller('ArticlesController', ['$scope', '$rootScope', '$stateParams', '$location', '$window', 'Global', 'Articles', 'Places', 'Feeds', 'PlacesFromSpreadsheet', 'uiGmapGoogleMapApi',
  function($scope, $rootScope, $stateParams, $location, $window, Global, Articles, Places, Feeds, PlacesFromSpreadsheet, GoogleMapApi ) {
    $scope.global = Global;
    // map marker icons?!
    var icon_reddot = '/articles/assets/img/dot-red.png';
    //var icon_bluedot = '/articles/assets/img/dot-blue.png';
    $scope.hideDistances = true;
    
    $scope.hasAuthorization = function(article) {
      if (!article || !article.user) return false;
      return $scope.global.isAdmin || article.user._id === $scope.global.user._id;
    };

    $scope.create = function(isValid) {
      if (isValid) {
        var article = new Articles({
          title: this.title,
          content: this.content
        });
        article.$save(function(response) {
          $location.path('articles/' + response._id);
        });

        this.title = '';
        this.content = '';
      } else {
        $scope.submitted = true;
      }
    };

    $scope.remove = function(article) {
      if (article) {
        article.$remove(function(response) {
          for (var i in $scope.articles) {
            if ($scope.articles[i] === article) {
              $scope.articles.splice(i, 1);
            }
          }
          $location.path('articles');
        });
      } else {
        $scope.article.$remove(function(response) {
          $location.path('articles');
        });
      }
    };

    $scope.update = function(isValid) {
      if (isValid) {
        var article = $scope.article;
        if (!article.updated) {
          article.updated = [];
        }
        article.updated.push(new Date().getTime());

        article.$update(function() {
          $location.path('articles/' + article._id);
        });
      } else {
        $scope.submitted = true;
      }
    };

    $scope.find = function() {
      $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
      Articles.query(function(articles) {
        $scope.articles = articles;
      });
    };
	
    $scope.mainmap = function() {
      $scope.uiRoute = 'map';
      $scope.map = {center: {latitude: 32.95, longitude: -117 }, zoom: 10, bounds: {}, control: {}, markerControl: {} };
      $scope.options = { mapTypeControl: false, panControl: false, streetViewControl: false, zoomControl: false };//scrollwheel: false};
      $scope.coordsUpdates = 0;
      $scope.dynamicMoveCtr = 0;
      
      $scope.markers = [];
      
      if ( $rootScope.hasOwnProperty('highlightPlace') ) {
        console.log('re-center map on highlight _id:'+ $rootScope.highlightPlace.id +' ' + $rootScope.highlightPlace.nameLongest);
        // re-center map at that place?
        $scope.map.center.latitude = $rootScope.highlightPlace.latitude;
        $scope.map.center.longitude = $rootScope.highlightPlace.longitude;
      }
      //	Map Styles : not sure how to inject otherwise..
      $scope.styles = [{'featureType':'water','elementType':'all','stylers':[{'hue':'#e9ebed'},{'saturation':-78},{'lightness':67},{'visibility':'simplified'}]},{'featureType':'landscape','elementType':'all','stylers':[{'hue':'#ffffff'},{'saturation':-100},{'lightness':100},{'visibility':'simplified'}]},{'featureType':'road','elementType':'geometry','stylers':[{'hue':'#bbc0c4'},{'saturation':-93},{'lightness':31},{'visibility':'simplified'}]},{'featureType':'poi','elementType':'all','stylers':[{'hue':'#ffffff'},{'saturation':-100},{'lightness':100},{'visibility':'off'}]},{'featureType':'road.local','elementType':'geometry','stylers':[{'hue':'#e9ebed'},{'saturation':-90},{'lightness':-8},{'visibility':'simplified'}]},{'featureType':'transit','elementType':'all','stylers':[{'hue':'#e9ebed'},{'saturation':10},{'lightness':69},{'visibility':'on'}]},{'featureType':'administrative.locality','elementType':'all','stylers':[{'hue':'#2c2e33'},{'saturation':7},{'lightness':19},{'visibility':'on'}]},{'featureType':'road','elementType':'labels','stylers':[{'hue':'#bbc0c4'},{'saturation':-93},{'lightness':31},{'visibility':'on'}]},{'featureType':'road.arterial','elementType':'labels','stylers':[{'hue':'#bbc0c4'},{'saturation':-93},{'lightness':-2},{'visibility':'simplified'}]}];
      
      /**
       * SUCCESS!! GoogleMapApi is a promise with then callback of google.maps obj
       */
      GoogleMapApi.then(function(maps) {
        // trigger gmap.resize when windows resize
        var w = angular.element($window);
        w.bind('resize', function() {
          var gmapd = $scope.map.control.getGMap();
          maps.event.trigger( gmapd, 'resize' );
        });
        // really initialize 400ms after gmap, which should be enough time
        setTimeout(function() {
          var gmapd = $scope.map.control.getGMap();
          // on home screen, add some map listener(s)
          var refilterTimeout = null;
          var refilter = function() {
            var gmapd = $scope.map.control.getGMap();
            // get the 2 boundary corners LatLng objects from the bounds
            var bounds = gmapd.getBounds();
            // https://developers.google.com/maps/documentation/javascript/reference#LatLngBounds
            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();
            // combine in to 1 String to pass to server
            var bounds_corners = ne.toString() +','+ sw.toString();
            // and then query to find all Places within current bounds
            Places.query({
              articleId: bounds_corners
            }, function(newplaces) {
              // check to reset old marker?
              var oldhighlight_id = false;
              if ( $rootScope.hasOwnProperty( 'highlightPlace' ) ) {
                oldhighlight_id = $rootScope.highlightPlace._id;
              }
              //console.log('queried Places : got :');
              //console.log(places);
              var newmarkers = [];
              angular.forEach(newplaces, function( marker, k ) {
                // set our default icon here?!
                marker.icon = icon_reddot;
                if ( oldhighlight_id === marker._id ) {
                  //marker.icon = icon_bluedot;
                  $rootScope.highlightPlace = marker;
                  $scope.highlightPlaceHasImg = ( marker.twit.img !== '' );
                  //$scope.loadHighlightPlaceFeed();
                }
                
                newmarkers.push(marker);
              });
              $scope.markers = newmarkers;
              //console.log('-- markers : ');
              //console.log($scope.markers);
            });
          };
          // throttle the refilter call so we don't call the server too much
          var refilterThrottle = function() {
            clearTimeout( refilterTimeout );
            // add throttled call to filter map markers in the area
            refilterTimeout = setTimeout( refilter, 200 );
          };
          // listen when the map center has manually been moved, or map zooms
          $scope.mapMoveListener = maps.event.addListener( gmapd, 'center_changed', refilterThrottle );
          $scope.mapZoomListener = maps.event.addListener( gmapd, 'zoom_changed', refilterThrottle );
          // initial check for markers in the area, too
          refilterThrottle();
        }, 400);
      });
      
      // set up our click / mouse events?
      $scope.markerClick = function( result, event ) {
        // can't figure out how to run a filter soooooooo
        angular.forEach( $scope.markers, function( marker, n ) {
          if ( marker.id === result.key ) {
            $rootScope.highlightPlace = marker;
            $scope.highlightPlaceHasImg = ( marker.twit.img !== '' ); 
          }
        });
        //console.log('clicked _id '+ result.key +' : '+ $rootScope.highlightPlace.nameFull);
        // #todo : now somehow social factory to get couple feed items from server?!
      };
      $scope.clickEventsObject = {
        click: $scope.markerClick
        /*,
        mouseover: $scope.markerMouseOver,
        mouseout: $scope.markerMouseOut,
        */
      };
    };
	
    $scope.findOne = function() {
      Articles.get({
        articleId: $stateParams.articleId
      }, function(article) {
        $scope.article = article;
      });
    };
    
    $scope.loadFeed = function() {
      $scope.newsLoaded = false;
      $scope.newsFeed = [];
      Feeds.query(function(items) {
        var news = [];
        angular.forEach(items, function( item, n ) {
          item.bodyClass = 'media-body';
          if ( item.img ) {
            item.hasMedia = true;
            item.bodyClass += ' has-media';
          } else {
            item.hasMedia = false;
          }
          news.push(item);
        });
        
        $scope.newsFeed = news;
        $scope.newsLoaded = true;
      });
    };
    /*
    $scope.loadHighlightPlaceFeed = function() {
      Feeds.query({
        '_id': $rootScope.highlightPlace._id
      }, function(items) {
        var news = [];
        angular.forEach(items, function( item, n ) {
          item.bodyClass = 'media-body';
          if ( item.img ) {
            item.hasMedia = true;
            item.bodyClass += ' has-media';
          } else {
            item.hasMedia = false;
          }
          news.push(item);
        });
        
        $rootScope.highlightPlace.newsFeed = news;
      });
    };
    */
    $scope.goBackToMap = function( highlightPlace ) {
      $rootScope.highlightPlace = highlightPlace;
      $location.path('map');
      return false;
    };
  }
]);
