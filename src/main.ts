import mapboxgl from 'mapbox-gl'
import TileManager from './core/tile_manager'

// DOM Configuration //////////////////////////////////////////////////////////////////////////////////////////////////////

// Map
const mapDiv = document.createElement('div')
mapDiv.style.height = '100%'
mapDiv.style.width = '100%'
mapDiv.style.zIndex = '1'
mapDiv.id = 'map'
document.body.appendChild(mapDiv)

mapboxgl.accessToken = 'pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg'

const empty = {
    version: 8,
    sources: {
        'placeholder-source': {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'Point',
                            coordinates: [-122.514, 37.684],
                        },
                    },
                ],
            },
        },
    },
    layers: [
        {
            id: 'placeholder-layer',
            type: 'circle',
            source: 'placeholder-source',
            paint: {
                'circle-color': 'red',
            },
        },
    ],
} as mapboxgl.StyleSpecification

const map = new mapboxgl.Map({
    // style: 'mapbox://styles/ycsoku/cm3zhjxbs00pa01sd6hx7grtr',
    // style: 'mapbox://styles/ycsoku/clrjfv4jz00pe01pdfxgshp6z',
    style: empty,
    center: [114.051537, 22.446937],
    projection: 'mercator',
    container: 'map',
    antialias: true,
    maxZoom: 22,
    zoom: 11,
})

map.on('load', () => {
    map.showTileBoundaries = true
    const tileManager = new TileManager(map)
    map.addLayer(tileManager as any as mapboxgl.CustomLayerInterface)
})

map.on('moveend', () => {
    const {
        _center: { lng, lat },
        zoom,
        pitch,
        bearing,
    } = map.transform

    window.location.hash = `#/${lng}/${lat}/${zoom}/${pitch}/${bearing}`
})

if (window.location.hash) {
    const [_, lng, lat, zoom, pitch, bearing] = window.location.hash.split('/')
    map.jumpTo({
        center: [+lng, +lat],
        zoom: +zoom,
        pitch: +pitch,
        bearing: +bearing,
    })
}
