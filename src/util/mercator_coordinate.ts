class MercatorCoordinate {

    static mercatorXfromLng(lng: number) {

        return (180.0 + lng) / 360
    }

    static mercatorYfromLat(lat: number) {

        return (180.0 - (180.0 / Math.PI * Math.log(Math.tan(Math.PI / 4.0 + lat * Math.PI / 360.0)))) / 360.0
    }

    static fromLngLat(lngLat: Array<number>) {

        let x = MercatorCoordinate.mercatorXfromLng(lngLat[0])
        let y = MercatorCoordinate.mercatorYfromLat(lngLat[1])

        x = x * 2.0 - 1.0
        y = 1.0 - y * 2.0

        return [x, y]
    }

    static lngFromMercatorX(x: number) {

        return x * 360.0 - 180.0
    }

    static latFromMercatorY(y: number) {

        const y2 = 180.0 - y * 360.0
        return 360.0 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180.0)) - 90.0
    }

    static fromXY(xy: Array<number>) {

        let [x, y] = xy
        const lng = MercatorCoordinate.lngFromMercatorX((1.0 + x) / 2.0)
        const lat = MercatorCoordinate.latFromMercatorY((1.0 - y) / 2.0)
        return [lng, lat]
    }
}

export default MercatorCoordinate