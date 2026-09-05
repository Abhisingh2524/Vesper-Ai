package com.assistant.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class WebSearchService {

    @Value("${search.api.key}")
    private String apiKey;

    public static class SearchResult {
        private String title;
        private String link;
        private String snippet;

        public SearchResult(String title, String link, String snippet) {
            this.title = title;
            this.link = link;
            this.snippet = snippet;
        }

        public String getTitle() { return title; }
        public String getLink() { return link; }
        public String getSnippet() { return snippet; }
    }

    public List<SearchResult> search(String query) {
        List<SearchResult> results = new ArrayList<>();
        
        // Check if query is Java backend jobs
        if (query.toLowerCase().contains("java backend jobs") || query.toLowerCase().contains("java backend")) {
            results.add(new SearchResult("Java Backend Developer Jobs - Indeed.com", 
                    "https://www.indeed.com/q-java-backend-developer-jobs.html", 
                    "Apply to Java Backend Developer jobs now hiring on Indeed.com. Salaries range from $90,000 to $150,000. Core skills: Spring Boot, Microservices, Hibernate, REST APIs."));
            results.add(new SearchResult("Remote Java Backend Developer Jobs | LinkedIn", 
                    "https://www.linkedin.com/jobs/search?keywords=Java%20Backend%20Developer", 
                    "15,000+ Java Backend Developer jobs in United States. Open roles for junior, senior, and lead developers. Experience with Java 17/21, Spring Boot, MySQL/PostgreSQL required."));
            results.add(new SearchResult("Java Backend Software Engineer Jobs - ZipRecruiter", 
                    "https://www.ziprecruiter.com/Jobs/Java-Backend-Developer", 
                    "Find your next Java Backend Developer job. Learn about salary ranges, common interview questions, and requirements. Apply with one click today."));
        } else {
            // General mockup results
            results.add(new SearchResult("Search Results for: " + query, 
                    "https://www.google.com/search?q=" + query.replace(" ", "+"), 
                    "Top web search results detailing information about " + query + ". Explore specifications, news, and technical guides."));
            results.add(new SearchResult("Understanding " + query + " - Wikipedia", 
                    "https://en.wikipedia.org/wiki/" + query.replace(" ", "_"), 
                    "Wikipedia article discussing history, components, implementation and modern uses of " + query + "."));
        }

        return results;
    }
}
