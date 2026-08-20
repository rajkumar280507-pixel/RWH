import { useRef } from "react";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";

const TN_CENTER = [11.1271, 78.6569];

/**
 * Lets the user either draw a rooftop polygon by hand or upload a GeoJSON
 * footprint. Emits the drawn/uploaded polygon as GeoJSON via onChange.
 */
export default function DrawRoofMap({ onChange }) {
  const featureGroupRef = useRef(null);

  const emitFromLayer = (layer) => {
    const geojson = layer.toGeoJSON();
    onChange(geojson.geometry);
  };

  const handleCreated = (e) => {
    const group = featureGroupRef.current;
    if (group) {
      // Only one rooftop polygon at a time — clear anything drawn before.
      group.eachLayer((l) => {
        if (l !== e.layer) group.removeLayer(l);
      });
    }
    emitFromLayer(e.layer);
  };

  const handleEdited = (e) => {
    e.layers.eachLayer((layer) => emitFromLayer(layer));
  };

  const handleDeleted = () => onChange(null);

  return (
    <MapContainer center={TN_CENTER} zoom={16} className="h-full w-full rounded-xl">
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
      />
      <FeatureGroup ref={featureGroupRef}>
        <EditControl
          position="topright"
          onCreated={handleCreated}
          onEdited={handleEdited}
          onDeleted={handleDeleted}
          draw={{
            rectangle: true,
            polygon: true,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false,
          }}
        />
      </FeatureGroup>
    </MapContainer>
  );
}
