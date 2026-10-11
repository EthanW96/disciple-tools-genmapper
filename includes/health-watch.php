<?php
if ( !defined( 'ABSPATH' ) ) {
    exit;
} // Exit if accessed directly.

/**
 * Health watch settings: the thresholds used to flag groups that may need attention.
 * Flags are only shown on the charts; nothing is written to the records.
 */
class DT_Genmapper_Health_Watch
{
    const DEFAULT_KEY_PRACTICES = [ 'church_leaders', 'church_baptism', 'church_communion' ];

    // option => [ default, min, max ]
    const NUMBER_OPTIONS = [
        'dt_genmapper_watch_percentile' => [ 75, 50, 95 ],
        'dt_genmapper_watch_quiet_months' => [ 3, 1, 24 ],
        'dt_genmapper_watch_member_drop' => [ 30, 10, 90 ],
        'dt_genmapper_watch_coach_load' => [ 5, 1, 50 ],
    ];
    const KEY_PRACTICES_OPTION = 'dt_genmapper_watch_key_practices';

    /**
     * Church Health practices on this site (key => label).
     *
     * @return array
     */
    public static function practice_options() {
        $fields = DT_Posts::get_post_field_settings( 'groups' );
        return array_map( function ( $option ) {
            return $option['label'] ?? '';
        }, $fields['health_metrics']['default'] ?? [] );
    }

    public static function number( string $option ) {
        [ $default, $min, $max ] = self::NUMBER_OPTIONS[ $option ];
        $value = get_option( $option, $default );
        return is_numeric( $value ) ? max( $min, min( $max, (int) $value ) ) : $default;
    }

    /**
     * Saved key practices that still exist on the site.
     *
     * @return array practice keys
     */
    public static function key_practices() {
        $saved = get_option( self::KEY_PRACTICES_OPTION, self::DEFAULT_KEY_PRACTICES );
        return array_values( array_intersect( is_array( $saved ) ? $saved : [], array_keys( self::practice_options() ) ) );
    }

    /**
     * Settings for the flags script (see timeline-flags.js DEFAULT_SETTINGS).
     *
     * @return array
     */
    public static function settings() {
        return [
            'percentile' => self::number( 'dt_genmapper_watch_percentile' ) / 100,
            'quietMonths' => self::number( 'dt_genmapper_watch_quiet_months' ),
            'memberDropShare' => self::number( 'dt_genmapper_watch_member_drop' ) / 100,
            'maxGroupsPerCoach' => self::number( 'dt_genmapper_watch_coach_load' ),
            'keyPractices' => self::key_practices(),
            'practiceLabels' => self::practice_options(),
        ];
    }

    /**
     * Save the settings from the admin form. Out-of-range numbers are clamped; unknown practices dropped.
     */
    public static function save( array $post ) {
        foreach ( self::NUMBER_OPTIONS as $option => [ $default, $min, $max ] ) {
            $value = isset( $post[ $option ] ) && is_numeric( $post[ $option ] ) ? (int) $post[ $option ] : $default;
            update_option( $option, max( $min, min( $max, $value ) ) );
        }
        $practices = isset( $post[ self::KEY_PRACTICES_OPTION ] ) && is_array( $post[ self::KEY_PRACTICES_OPTION ] )
            ? array_map( 'sanitize_key', wp_unslash( $post[ self::KEY_PRACTICES_OPTION ] ) )
            : [];
        update_option( self::KEY_PRACTICES_OPTION, array_values( array_intersect( $practices, array_keys( self::practice_options() ) ) ) );
    }
}
