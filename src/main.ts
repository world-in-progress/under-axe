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
    glyphs: "/glyphs/{fontstack}/{range}.pbf",
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
                            coordinates: [120.2803920596891106, 34.3030449664098393],
                        },
                    },
                ],
            },
        },
    },
    layers: [
        // {
        //     id: 'placeholder-layer',
        //     type: 'circle',
        //     minzoom: 0,
        //     maxzoom: 5,
        //     source: 'placeholder-source',
        //     paint: {
        //         'circle-color': 'red',
        //     },
        // },
    ],
} as mapboxgl.StyleSpecification

const map = new mapboxgl.Map({
    // style: 'mapbox://styles/ycsoku/cm3zhjxbs00pa01sd6hx7grtr',
    // style: 'mapbox://styles/ycsoku/clrjfv4jz00pe01pdfxgshp6z',
    style: empty,
    center: [120.2803920596891106, 34.3030449664098393],
    projection: 'mercator',
    container: 'map',
    antialias: true,
    zoom: 13.5,
})

map.on('load', () => {

    const tileManager = new TileManager(map)
    map.addLayer(tileManager)

    // terrainTest(map)
    // addPlaceHolder(map)
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


function terrainTest(map: mapboxgl.Map) {
    map.addSource('terrain', {
        type: 'raster-dem',
        minzoom: 0,
        maxzoom: 14,
        tileSize: 128,
        tiles: [
            '/TTB/128/{z}/{x}/{y}.png'
        ]
    })
    map.setTerrain({ "source": 'terrain', "exaggeration": 30.0 })
}

function addPlaceHolder(map: mapboxgl.Map) {
    map.showTileBoundaries = true
    map.addLayer(
        {
            id: 'placeholder-layer',
            type: 'circle',
            minzoom: 0,
            maxzoom: 16,
            source: 'placeholder-source',
            paint: {
                'circle-color': 'red',
            },
        },
    )
}