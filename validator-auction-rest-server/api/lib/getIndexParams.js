export default function getIndexParams(technology, blockchain, network, resources, index, type) {

    let i = index
    let t = type

    if (!i && RegExp(/^\w+-\w+-\w+-\w+/).test((Array.isArray(t) ? t[0] : t))) {
        i = type
        t = index
    }

    let indices = (Array.isArray(i) ? i : (i || '').split(','))
        .map(v => (v || '').trim())
        .filter(v => !!v)
        .filter(v => RegExp(`${technology}-${blockchain}-${network}-(${resources.join('|')})`).test(v))

    let types = (Array.isArray(t) ? t : (t || '').split(','))
        .map(v => (v || '').trim())
        .filter(v => !!v)
        .filter(v => resources.indexOf(v) !== -1)

    types.push(...(indices.map(v => v.replace(`${technology}-${blockchain}-${network}-`, ''))))
    indices.push(...(types.map(v => `${technology}-${blockchain}-${network}-${v}`)))

    return {
        index: indices.filter((v, i, a) => a.indexOf(v) === i).join(','),
        type: types.filter((v, i, a) => a.indexOf(v) === i).join(',')
    }
}
