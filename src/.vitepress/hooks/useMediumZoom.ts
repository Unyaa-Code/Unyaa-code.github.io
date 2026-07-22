import mediumZoom from 'medium-zoom'
import { inject, nextTick, onMounted } from 'vue'
import type { Zoom } from 'medium-zoom'
import type { App, InjectionKey } from 'vue'
import type { Router } from 'vitepress'

declare module 'medium-zoom' {
    interface Zoom {
        refresh: (selector?: string) => void
    }
}

export const mediumZoomSymbol: InjectionKey<Zoom> = Symbol('mediumZoom')

export function useMediumZoom() {
    onMounted(() => inject(mediumZoomSymbol)?.refresh())
}

export function useMediumZoomProvider(app: App, router: Router) {
    //@ts-ignore
    if (import.meta.env.SSR) return
    const zoom = mediumZoom()
    zoom.refresh = () => {
        zoom.detach()
        zoom.attach(':not(a) > img')
    }
    app.provide(mediumZoomSymbol, zoom)

    router.onAfterRouteChanged = () => {
        nextTick(() => zoom.refresh())
    }

    // 在 app.mount 之后触发初始 attach
    const originalMount = app.mount.bind(app)
    app.mount = ((rootContainer: Element) => {
        const result = originalMount(rootContainer)
        nextTick(() => zoom.refresh())
        return result
    }) as typeof app.mount
}