<div class="wrap">
    <h2><?php /* translators: %s: chart label, e.g. GEN MAPPER */ echo esc_html( sprintf( __( 'DISCIPLE TOOLS - %s', 'disciple-tools-genmapper' ), strtoupper( DT_Genmapper_Metrics::chart_label() ) ) ) ?></h2>
    <div class="nav-tab-wrapper">
        <?php foreach ( $tabs as $item ): ?>
            <a href="<?php echo esc_url( $link . $item['key'] ); ?>"
               class="nav-tab <?php echo ( $current_tab === $item['key'] ) ? esc_attr( 'nav-tab-active' ) : ''; ?>"><?php echo esc_html( $item['label'] ) ?></a>
        <?php endforeach ?>
    </div>
    <div id="poststuff">
        <?php
            $tab_object->content();
        ?>
    </div><!--poststuff end -->
</div><!-- wrap end -->

