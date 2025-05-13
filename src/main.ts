import mapboxgl from 'mapbox-gl'
import TileManager from './core/tile_manager'
import { TileDrivenLayer } from './test/tileDrivenLayer'
// DOM Configuration //////////////////////////////////////////////////////////////////////////////////////////////////////

// Map
const mapDiv = document.createElement('div')
mapDiv.style.height = '100%'
mapDiv.style.width = '100%'
mapDiv.style.zIndex = '1'
mapDiv.id = 'map'
document.body.appendChild(mapDiv)

// Debug
const container = document.createElement('div')
container.style.position = 'fixed'
container.style.top = '20px'
container.style.left = '20px'
document.body.appendChild(container)

mapboxgl.accessToken = 'pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg'

const empty = {
    version: 8,
    glyphs: '/glyphs/{fontstack}/{range}.pbf',
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
    minZoom: 1,
    zoom: 1,
})

map.on('load', () => {
    const tileManager = new TileManager(map) // 'tile_manager'
    map.addLayer(tileManager)

    addContrastDom(tileManager)

    // const tileDrivenLayer = new TileDrivenLayer('dLayer', tileManager)
    // map.addLayer(tileDrivenLayer)

    // terrainTest(map)
    // addPlaceHolder(map)

    // new mapboxgl.Marker().setLngLat([120.2803920596891106, 34.3030449664098393])
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
        tiles: ['/TTB/128/{z}/{x}/{y}.png'],
    })
    map.setTerrain({ source: 'terrain', exaggeration: 30.0 })
}

function addPlaceHolder(map: mapboxgl.Map) {
    map.showTileBoundaries = true
    map.addLayer({
        id: 'placeholder-layer',
        type: 'circle',
        minzoom: 0,
        maxzoom: 16,
        source: 'placeholder-source',
        paint: {
            'circle-color': 'red',
        },
    })
}

function addContrastDom(tileManager: TileManager) {
    const domfrag = document.createDocumentFragment()

    const button1 = document.createElement('button')
    button1.innerText = 'mapbox-raster-layer'
    button1.onclick = () => {
        map.addLayer({
            id: 'mapbox-raster-layer',
            type: 'raster',
            source: {
                id: 'mapbox-raster-source',
                type: 'raster',
                tiles: ['https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'],
            },
        })
    }
    domfrag.appendChild(button1)

    const button2 = document.createElement('button')
    button2.innerText = 'underaxe-raster-layer'
    button2.onclick = () => {
        const tileDrivenLayer = new TileDrivenLayer('dLayer', tileManager)
        map.addLayer(tileDrivenLayer)
    }
    domfrag.appendChild(button2)

    const button3 = document.createElement('button')
    button3.innerText = 'remove-all'
    button3.onclick = () => {
        if (map.getLayer('dLayer')) {
            map.removeLayer('dLayer')
        }

        if (map.getLayer('mapbox-raster-layer')) {
            const layer = map.getLayer('mapbox-raster-layer')!
            const source = layer.source
            map.removeLayer('mapbox-raster-layer')
            source && map.removeSource(source)
        }
    }
    domfrag.appendChild(button3)

    container.appendChild(domfrag)
}
