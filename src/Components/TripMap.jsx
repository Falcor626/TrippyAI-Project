import { GoogleMap, LoadScript, DirectionsRenderer, useLoadScript } from '@react-google-maps/api';
import { useState, useEffect, useCallback } from 'react';

const mapStyles = {
  height: '400px',
  width: '100%',
  borderRadius: '8px',
};

const libraries = ['directions'];

function TripMap({ destination, departureCity }) {
  const [directions, setDirections] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.006 });
  const [directionsService, setDirectionsService] = useState(null);

  const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: API_KEY,
    libraries,
  });

  // Initialize DirectionsService when script loads
  useEffect(() => {
    if (isLoaded && window.google) {
      setDirectionsService(new window.google.maps.DirectionsService());
    }
  }, [isLoaded]);

  // Calculate route when service is ready and params change
  useEffect(() => {
    if (!directionsService || !destination || !departureCity) return;

    directionsService.route(
      {
        origin: departureCity,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          // Center map on the route
          if (result.routes[0]) {
            const bounds = new window.google.maps.LatLngBounds();
            result.routes[0].overview_path.forEach(point => bounds.extend(point));
            setMapCenter(bounds.getCenter().toJSON());
          }
        } else {
          console.error('Directions request failed:', status);
        }
      }
    );
  }, [directionsService, destination, departureCity]);

  if (loadError) return <div>Error loading map</div>;
  if (!isLoaded) return <div>Loading map...</div>;

  return (
    <div className="trip-map-container">
      <h3 className="trip-map-title">🗺️ Your Route</h3>
      <p className="trip-map-subtitle">From {departureCity} to {destination}</p>
      
      <GoogleMap
          mapContainerStyle={mapStyles}
          center={mapCenter}
          zoom={6}
          options={{
            styles: [
              {
                elementType: 'geometry',
                stylers: [{ color: '#1a1a1a' }],
              },
              {
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#1a1a1a' }],
              },
              {
                elementType: 'labels.text.fill',
                stylers: [{ color: '#f7f4ee' }],
              },
              {
                featureType: 'administrative.country',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#38414e' }],
              },
              {
                featureType: 'administrative.land_parcel',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#bdbdbd' }],
              },
              {
                featureType: 'poi',
                elementType: 'geometry',
                stylers: [{ color: '#212121' }],
              },
              {
                featureType: 'poi',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#757575' }],
              },
              {
                featureType: 'poi.park',
                elementType: 'geometry',
                stylers: [{ color: '#1a3a2a' }],
              },
              {
                featureType: 'poi.park',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#9e9e9e' }],
              },
              {
                featureType: 'road',
                elementType: 'geometry.fill',
                stylers: [{ color: '#2c2c2c' }],
              },
              {
                featureType: 'road',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#f7f4ee' }],
              },
              {
                featureType: 'road.arterial',
                elementType: 'geometry',
                stylers: [{ color: '#373737' }],
              },
              {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#3c3c3c' }],
              },
              {
                featureType: 'road.highway.controlled_access',
                elementType: 'geometry',
                stylers: [{ color: '#4e4e4e' }],
              },
              {
                featureType: 'road.local',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#616161' }],
              },
              {
                featureType: 'transit',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#757575' }],
              },
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#0f2540' }],
              },
              {
                featureType: 'water',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#3d3d3d' }],
              },
            ],
          }}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: false,
                polylineOptions: {
                  zIndex: 50,
                  strokeColor: '#f0b86c',
                  strokeWeight: 5,
                  strokeOpacity: 0.9,
                },
                markerOptions: {
                  icon: 'https://maps.google.com/mapfiles/ms/micons/yellow-dot.png',
                },
              }}
              onLoad={() => console.log('Directions loaded')}
            />
          )}
        </GoogleMap>
    </div>
  );
}

export default TripMap;
