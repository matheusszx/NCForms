package com.ncforms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class NcFormsApplication {

    public static void main(String[] args) {
        SpringApplication.run(NcFormsApplication.class, args);
    }
}
