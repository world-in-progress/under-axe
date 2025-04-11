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

const canvas2d = document.createElement('canvas')
canvas2d.id = 'canvas2d'
document.body.appendChild(canvas2d)

mapboxgl.accessToken = 'pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg'

const map = new mapboxgl.Map({
    style: 'mapbox://styles/ycsoku/cm3zhjxbs00pa01sd6hx7grtr',
    // style: 'mapbox://styles/ycsoku/clrjfv4jz00pe01pdfxgshp6z',
    center: [114.051537, 22.446937],
    projection: 'mercator',
    container: 'map',
    antialias: true,
    maxZoom: 22,
    zoom: 11

})

map.on('load', () => {
    const tileManager = new TileManager(map)
    map.addLayer(tileManager)
})
